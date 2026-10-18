'''
Invoices registrars make and send, and paying one through its public link
(SPEC §9.7; DR-95, DR-96; GitHub #670, #623).
'''

from decimal import Decimal

from django.core import mail
from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from camphoric import deletes, invoices, models, roles
from camphoric.serializers import Conflict
from camphoric.views import InvoiceViewSet, RegistrationViewSet
from tests import paypal_mocks
from tests.factories import create_template_event, make_user, registration_invoice

D = Decimal


class InvoicePayTestCase(paypal_mocks.PayPalServerMixin, APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()
        event = cls.made.event
        event.paypal_client_id = 'client'
        event.epayment_handling = D('2.5')
        event.save()
        cls.registrar = make_user(roles.REGISTRAR, 'reggie')
        cls.reporter = make_user(roles.REPORTER, 'rita')
        # Pat's $825 check invoice, with $100 paid: $725 due (#623).
        cls.invoice = cls.made.i1
        cls.invoice.notes = 'Promised by June'
        cls.invoice.memo = 'Thanks!'
        cls.invoice.save()

    def page(self, invoice=None, status=200):
        invoice = invoice or self.invoice
        response = self.client.get(f'/api/invoices/pay/{invoice.token}')
        self.assertEqual(response.status_code, status, getattr(response, 'data', None))
        return response.data

    def post(self, action, status=200, invoice=None, **data):
        invoice = invoice or self.invoice
        response = self.client.post(f'/api/invoices/pay/{invoice.token}/{action}', data,
                                    format='json')
        self.assertEqual(response.status_code, status, getattr(response, 'data', None))
        return response.data


class PublicPageTests(InvoicePayTestCase):
    def test_what_anyone_with_the_link_sees(self):
        data = self.page()
        self.assertEqual(data['event'], {'id': self.made.event.id, 'name': 'Test Camp'})
        self.assertEqual(data['campers'], ['Pat A.', 'Sam A.'])
        invoice = data['invoice']
        self.assertEqual((invoice['description'], invoice['amount_due'], invoice['status'],
                          invoice['memo']), ('Full Payment', '725.00', 'partially_paid',
                                             'Thanks!'))
        self.assertNotIn('notes', invoice)
        self.assertNotIn('registrant_email', str(data))
        self.assertEqual(data['online'], {'clientId': 'client', 'handling': 18.13,
                                          'total': 743.13, 'handlingPercent': 2.5})

    def test_nothing_to_pay_online(self):
        self.assertIsNone(self.page(self.made.i2)['online'])  # overpaid
        self.invoice.cancelled_at = '2026-10-01T00:00:00Z'
        self.invoice.save()
        data = self.page()
        self.assertEqual((data['invoice']['status'], data['online']), ('cancelled', None))

    def test_without_paypal(self):
        self.made.event.paypal_enabled = False
        self.made.event.save()
        self.assertIsNone(self.page()['online'])

    def test_unknown_links(self):
        self.client.get('/api/invoices/pay/nope')
        self.assertEqual(self.client.get('/api/invoices/pay/nope').status_code, 404)
        incomplete = registration_invoice(self.made.r3, 'Check', D('10'))
        self.page(incomplete, status=404)


class PayingTests(InvoicePayTestCase):
    def test_a_check_invoice_paid_online_adds_the_fee_then(self):
        self.reply(paypal_mocks.created())
        data = self.post('order', paymentType='Card')
        self.assertEqual(data['orderID'], paypal_mocks.ORDER_ID)
        unit = self.paypal.requests[0]['json']['purchase_units'][0]
        self.assertEqual(unit['custom_id'], f'invoice:{self.invoice.id}')
        self.assertEqual(unit['amount']['value'], '743.13')
        self.assertEqual(unit['items'][0]['name'],
                         f'Total for Invoice #{self.invoice.id} for Test Camp')
        invoice = models.Invoice.objects.get(pk=self.invoice.pk)
        self.assertEqual((invoice.handling, invoice.payment_type), (D('0.00'), 'Card'))

        registration = self.made.r1
        self.reply(paypal_mocks.order(registration, invoice, D('743.13'), source='card'),
                   paypal_mocks.captured(registration, invoice, D('743.13'), source='card'))
        data = self.post('capture', orderID=paypal_mocks.ORDER_ID, paymentType='Card')
        self.assertEqual((data['invoice']['status'], data['invoice']['handling'],
                          data['online']), ('paid', '18.13', None))
        payment = invoice.payments.order_by('id').last()
        self.assertEqual((payment.amount, payment.payment_type, payment.notes),
                         (D('743.13'), 'Card', 'Paid online'))

    def test_an_order_for_another_invoice_is_refused(self):
        other = registration_invoice(self.made.r1, 'Check', D('50'))
        self.reply(paypal_mocks.created())
        self.post('order', paymentType='PayPal', invoice=other)
        # Replaying that order on this invoice's link.
        self.reply(paypal_mocks.order(self.made.r1, other, D('51.25')))
        self.invoice.pending_paypal_order_id = paypal_mocks.ORDER_ID
        self.invoice.save()
        data = self.post('capture', status=400, orderID=paypal_mocks.ORDER_ID,
                         paymentType='PayPal')
        self.assertEqual(data['code'], 'mismatch')

    def test_an_order_id_that_isnt_one_is_refused_unsent(self):
        self.reply(paypal_mocks.created())
        self.post('order', paymentType='PayPal')
        data = self.post('capture', status=400, orderID='../../v1/oauth2/token',
                         paymentType='PayPal')
        self.assertEqual(data['code'], 'mismatch')
        self.assertEqual(len(self.paypal.requests), 1)  # only the order's creation
        self.assertTrue(models.Invoice.objects.get(pk=self.invoice.pk).pending_paypal_order_id)

    def test_a_paid_invoice_takes_no_order(self):
        data = self.post('order', status=409, invoice=self.made.i2, paymentType='PayPal')
        self.assertEqual(data['code'], 'not_payable')

    def test_a_lost_answer_emails_the_event(self):
        self.reply(paypal_mocks.created())
        self.post('order', paymentType='PayPal')
        self.reply(paypal_mocks.order(self.made.r1, self.invoice, D('743.13')))
        self.paypal.add_mock_response(503, {}, {})
        data = self.post('capture', status=502, orderID=paypal_mocks.ORDER_ID,
                         paymentType='PayPal')
        self.assertEqual(data['code'], 'unknown')
        self.assertTrue(data['invoice']['pending'])
        self.assertEqual(len([m for m in mail.outbox if 'needs checking' in m.subject]), 1)

    def test_only_online_payments(self):
        self.post('order', status=400, paymentType='Check')

    def test_a_pending_capture_shows_as_processing(self):
        # Captured, but PayPal hasn't completed it: not a payment yet (#767).
        self.reply(paypal_mocks.created())
        self.post('order', paymentType='PayPal')
        invoice = models.Invoice.objects.get(pk=self.invoice.pk)
        self.reply(paypal_mocks.order(self.made.r1, invoice, D('743.13')),
                   paypal_mocks.captured(self.made.r1, invoice, D('743.13'),
                                         capture_status='PENDING'))
        data = self.post('capture', status=409, orderID=paypal_mocks.ORDER_ID,
                         paymentType='PayPal')
        self.assertEqual(data['code'], 'pending')
        self.assertEqual((data['invoice']['status'], data['invoice']['processing'],
                          data['invoice']['pending'], data['online']),
                         ('partially_paid', True, True, None))
        self.assertTrue(self.page()['invoice']['processing'])
        self.assertEqual(invoice.payments.count(), 1)  # only the $100 paid before
        self.assertEqual(self.post('order', status=409, paymentType='PayPal')['code'],
                         'not_payable')

        self.client.force_authenticate(self.registrar)
        self.assertTrue(self.client.get(f'/api/invoices/{invoice.id}/').data[
            'paypal_capture_pending'])


class WhilePayPalHasAPaymentTests(InvoicePayTestCase):
    '''
    An invoice PayPal is processing a payment on (#767), or one whose capture
    hasn't settled (#804), is neither deleted nor cancelled: the worker, or
    "Check PayPal order", records the payment on it once PayPal completes it.
    '''

    def setUp(self):
        super().setUp()
        self.extra = models.Invoice.objects.create(
            registration=self.made.r1, origin=models.InvoiceOrigin.ADMIN,
            description='Extra', amount=D('50.00'))
        self.admin = make_user(roles.ADMIN, 'adam')

    def capture_pending(self):
        self.reply(paypal_mocks.created())
        total = D(str(self.post('order', invoice=self.extra, paymentType='PayPal')['online'][
            'total']))  # $50 and its $1.25 fee, less anything paid on it
        self.extra.refresh_from_db()
        self.reply(paypal_mocks.order(self.made.r1, self.extra, total),
                   paypal_mocks.captured(self.made.r1, self.extra, total,
                                         capture_status='PENDING'))
        data = self.post('capture', status=409, invoice=self.extra,
                         orderID=paypal_mocks.ORDER_ID, paymentType='PayPal')
        self.assertEqual(data['code'], 'pending')

    def delete(self):
        self.client.force_authenticate(self.admin)
        preview = self.client.get(f'/api/invoices/{self.extra.id}/delete-preview/').data
        return preview, self.client.delete(f'/api/invoices/{self.extra.id}/')

    def test_one_paypal_is_processing_a_payment_on_isnt_deleted(self):
        self.capture_pending()
        preview, response = self.delete()
        self.assertFalse(preview['can_delete'])
        self.assertEqual(response.status_code, 409)
        self.assertIn('PayPal is still processing a payment', response.data['detail'])
        self.extra.refresh_from_db()
        self.assertEqual(self.extra.paypal_capture_order_id, paypal_mocks.ORDER_ID)

    def test_nor_cancelled(self):
        self.capture_pending()
        self.client.force_authenticate(self.registrar)
        response = self.client.post(f'/api/invoices/{self.extra.id}/cancel/', format='json')
        self.assertEqual(response.status_code, 409)
        self.extra.refresh_from_db()
        self.assertIsNone(self.extra.cancelled_at)

    def test_nor_one_whose_capture_is_being_confirmed(self):
        models.Invoice.objects.filter(pk=self.extra.pk).update(
            pending_paypal_order_id=paypal_mocks.ORDER_ID,
            paypal_capture_order_id=paypal_mocks.ORDER_ID,
            paypal_capture_started_at=timezone.now())
        preview, response = self.delete()
        self.assertFalse(preview['can_delete'])
        self.assertEqual(response.status_code, 409)
        self.assertIn('still being confirmed', response.data['detail'])

    def test_a_capture_that_starts_after_the_delete_was_planned(self):
        plan = deletes.plan(self.extra, InvoiceViewSet().delete_checks())
        self.assertTrue(plan.can_delete)
        models.Invoice.objects.filter(pk=self.extra.pk).update(
            pending_paypal_order_id=paypal_mocks.ORDER_ID,
            paypal_capture_order_id=paypal_mocks.ORDER_ID,
            paypal_capture_started_at=timezone.now())
        with self.assertRaises(Conflict):
            plan.carry_out()
        self.assertTrue(models.Invoice.objects.filter(pk=self.extra.pk).exists())

    def test_what_it_asks_isnt_changed(self):
        # The fee is worked out when the payment is recorded (#767).
        self.capture_pending()
        self.client.force_authenticate(self.registrar)
        url = f'/api/invoices/{self.extra.id}/'
        for change in ({'amount': '60.00'}, {'handling': '2.00'}):
            response = self.client.patch(url, change, format='json')
            self.assertEqual(response.status_code, 409, change)
            self.assertIn('PayPal is still processing a payment', response.data['detail'])
        response = self.client.patch(url, {'memo': 'Thanks', 'amount': '50.00'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)

    def test_no_other_payment_is_recorded_on_it(self):
        self.capture_pending()
        self.client.force_authenticate(self.registrar)
        payment = {'registration': self.made.r1.id, 'payment_type': 'Check',
                   'amount': '50.00', 'paid_on': '2026-10-01'}
        response = self.client.post('/api/payments/', {**payment, 'invoice': self.extra.id},
                                    format='json')
        self.assertEqual(response.status_code, 409)
        self.assertIn('PayPal is still processing a payment', response.data['detail'])
        # Nor does one recorded without an invoice choose it.
        models.Invoice.objects.filter(pk=self.invoice.pk).update(cancelled_at=timezone.now())
        response = self.client.post('/api/payments/', payment, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotEqual(response.data['invoice'], self.extra.id)
        self.assertFalse(self.extra.payments.exists())

    def check_on_it(self):
        '''A $10 check recorded on it before PayPal's payment.'''
        return models.Payment.objects.create(
            registration=self.made.r1, invoice=self.extra, payment_type='Check',
            amount=D('10.00'))

    def test_a_payment_on_it_isnt_restored(self):
        check = self.check_on_it()
        check.soft_delete()
        self.capture_pending()
        self.client.force_authenticate(self.registrar)
        response = self.client.post(f'/api/payments/{check.id}/restore/')
        self.assertEqual(response.status_code, 409)
        self.assertIn('PayPal is still processing a payment', response.data['detail'])
        check.refresh_from_db()
        self.assertIsNotNone(check.deleted_at)

    def test_nor_raised(self):
        check = self.check_on_it()
        self.capture_pending()
        self.client.force_authenticate(self.registrar)
        url = f'/api/payments/{check.id}/'
        response = self.client.patch(url, {'amount': '20.00'}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertIn('PayPal is still processing a payment', response.data['detail'])
        response = self.client.patch(url, {'amount': '10.00', 'notes': 'Check #12'},
                                     format='json')
        self.assertEqual(response.status_code, 200, response.data)

    def test_its_registration_isnt_deleted(self):
        # It would hide the invoice the payment is recorded on (#767).
        self.capture_pending()
        self.client.force_authenticate(self.admin)
        url = f'/api/registrations/{self.made.r1.id}/'
        self.assertFalse(self.client.get(f'{url}delete-preview/').data['can_delete'])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 409)
        self.assertIn('PayPal is still processing a payment', response.data['detail'])
        self.assertTrue(models.Registration.objects.filter(pk=self.made.r1.pk).exists())

    def test_nor_one_a_capture_starts_on_after_its_delete_was_planned(self):
        plan = deletes.plan(self.made.r1, RegistrationViewSet().delete_checks())
        self.assertTrue(plan.can_delete)
        models.Invoice.objects.filter(pk=self.extra.pk).update(
            pending_paypal_order_id=paypal_mocks.ORDER_ID,
            paypal_capture_order_id=paypal_mocks.ORDER_ID,
            paypal_capture_started_at=timezone.now())
        with self.assertRaises(Conflict):
            plan.carry_out()
        self.assertTrue(models.Registration.objects.filter(pk=self.made.r1.pk).exists())

    def test_once_settled_it_can_go(self):
        self.capture_pending()
        self.reply(paypal_mocks.captured(self.made.r1, self.extra, D('51.25'),
                                         capture_status='DECLINED'))
        self.assertEqual(invoices.check_paypal_order(self.extra), ('not_captured', None))
        self.assertEqual(self.delete()[1].status_code, 204)


class LockOrderTests(InvoicePayTestCase):
    '''
    Writes to an invoice, or a payment on it, lock its registration before the
    invoice, as a capture and "Check PayPal order" do: the other order could
    deadlock with them (#767, #819).
    '''

    def locked(self, send):
        '''The tables `send` locked rows of, in the order it first locked them.'''
        with CaptureQueriesContext(connection) as queries:
            response = send()
        self.assertLess(response.status_code, 300, getattr(response, 'data', None))
        tables = []
        for query in queries.captured_queries:
            sql = query['sql']
            if 'FOR UPDATE' in sql:
                table = sql.split(' FROM ', 1)[1].split()[0].strip('"')
                if table not in tables:
                    tables.append(table)
        return tables

    def assertRegistrationFirst(self, send):
        tables = self.locked(send)
        self.assertIn('camphoric_invoice', tables)
        self.assertLess(tables.index('camphoric_registration'), tables.index('camphoric_invoice'),
                        tables)

    def test_deleting_an_invoice(self):
        extra = models.Invoice.objects.create(
            registration=self.made.r1, origin=models.InvoiceOrigin.ADMIN, amount=D('5.00'))
        self.client.force_authenticate(make_user(roles.ADMIN, 'adam'))
        self.assertRegistrationFirst(lambda: self.client.delete(f'/api/invoices/{extra.id}/'))

    def test_editing_cancelling_and_reopening_one(self):
        self.client.force_authenticate(self.registrar)
        url = f'/api/invoices/{self.made.i1.id}/'
        self.assertRegistrationFirst(
            lambda: self.client.patch(url, {'memo': 'Hi'}, format='json'))
        other = registration_invoice(self.made.r1, 'Check', D('5'))
        self.assertRegistrationFirst(
            lambda: self.client.post(f'/api/invoices/{other.id}/cancel/', format='json'))
        self.assertRegistrationFirst(
            lambda: self.client.post(f'/api/invoices/{other.id}/reopen/', format='json'))

    def test_recording_a_payment_on_one(self):
        self.client.force_authenticate(self.registrar)
        self.assertRegistrationFirst(lambda: self.client.post('/api/payments/', {
            'registration': self.made.r1.id, 'invoice': self.invoice.id,
            'payment_type': 'Check', 'amount': '5.00'}, format='json'))


class AdminInvoiceTests(InvoicePayTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.registrar)

    def test_registrars_make_invoices(self):
        response = self.client.post('/api/invoices/', {
            'registration': self.made.r2.id, 'description': 'Meal plan', 'amount': '120.00',
            'memo': 'Added at your request', 'due_on': '2027-06-20'}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        invoice = models.Invoice.objects.get(pk=response.data['id'])
        self.assertEqual((invoice.origin, invoice.created_by, invoice.amount),
                         ('admin', self.registrar, D('120.00')))
        self.assertTrue(response.data['pay_url'].endswith(f'/invoices/{invoice.token}'))
        self.assertNotIn('token', response.data)

        self.client.force_authenticate(self.reporter)
        response = self.client.post('/api/invoices/', {
            'registration': self.made.r2.id, 'amount': '1'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_an_invoice_stays_with_its_registration(self):
        response = self.client.patch(f'/api/invoices/{self.invoice.id}/',
                                     {'registration': self.made.r2.id}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_invoice_the_balance(self):
        self.made.i1.amount = D('400.00')
        self.made.i1.save()
        response = self.client.post(f'/api/registrations/{self.made.r1.id}/invoice-balance/',
                                    {'memo': 'The rest'}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual((response.data['description'], response.data['amount'],
                          response.data['origin']), ('Registration balance', '425.00', 'admin'))
        response = self.client.post(f'/api/registrations/{self.made.r1.id}/invoice-balance/')
        self.assertEqual(response.status_code, 409)

    @override_settings(CAMPHORIC_PUBLIC_URL='https://camp.example.org')
    def test_send_an_invoice(self):
        response = self.client.post(f'/api/invoices/{self.invoice.id}/send/')
        self.assertEqual(response.status_code, 200, response.data)
        message = models.EmailMessage.objects.get(pk=response.data['messageId'])
        self.assertEqual((message.kind, message.to, message.registration_id),
                         ('invoice', 'pat@example.com', self.made.r1.id))
        self.assertEqual(message.subject, f'Invoice #{self.invoice.id} for Test Camp')
        self.assertIn('Thanks!', message.text)
        self.assertIn('Full Payment: $725.00 due', message.text)
        self.assertIn(f'(https://camp.example.org/invoices/{self.invoice.token})', message.text)
        self.assertIn('(Pat, Sam)', message.text)

    def test_not_a_cancelled_one_nor_by_a_reporter(self):
        self.client.force_authenticate(self.reporter)
        self.assertEqual(self.client.post(f'/api/invoices/{self.invoice.id}/send/').status_code,
                         403)
        self.client.force_authenticate(self.registrar)
        other = registration_invoice(self.made.r1, 'Check', D('5'))
        other.cancelled_at = '2026-10-01T00:00:00Z'
        other.save()
        self.assertEqual(self.client.post(f'/api/invoices/{other.id}/send/').status_code, 409)

    def test_a_broken_template_sends_nothing(self):
        template = self.made.event.invoice_template
        template.body = '{{ invoice.nope.deeper }}'
        template.save()
        response = self.client.post(f'/api/invoices/{self.invoice.id}/send/')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(models.EmailMessage.objects.filter(kind='invoice').exists())

    def test_the_invoice_email_template(self):
        template = self.made.event.invoice_template
        self.assertEqual((template.purpose, template.name), ('invoice', 'Invoice'))
        # It comes with the event; it can't be deleted.
        self.assertEqual(self.client.delete(f'/api/emailtemplates/{template.id}/').status_code,
                         409)

    def test_preview_and_check(self):
        admin = make_user(roles.ADMIN, 'boss')
        self.client.force_authenticate(admin)
        response = self.client.post(f'/api/events/{self.made.event.id}/templates/preview', {
            'context': 'invoice_email', 'output': 'email', 'subject': 'Hi',
            'template': '{{ invoice.description }} {{ campers | length }}',
            'invoice_id': self.invoice.id}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['output'], 'Full Payment 2')
        self.assertEqual(response.data['sample']['label'],
                         f'Invoice #{self.invoice.id} (Full Payment)')
        response = self.client.get(f'/api/events/{self.made.event.id}/templates/check')
        [result] = [r for r in response.data['results'] if r['kind'] == 'invoice_email']
        self.assertEqual((result['mode'], result['diagnostics']), ('rendered', []))

'''
Invoices registrars make and send, and paying one through its public link
(SPEC §9.7; DR-95, DR-96; GitHub #670, #623).
'''

from decimal import Decimal

from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from camphoric import models, roles
from tests import paypal_mocks
from tests.factories import create_template_event, make_user, registration_invoice

D = Decimal


class InvoicePayTestCase(paypal_mocks.PayPalServerMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.made = create_template_event()
        event = self.made.event
        event.paypal_client_id = 'client'
        event.epayment_handling = D('2.5')
        event.save()
        self.registrar = make_user(roles.REGISTRAR, 'reggie')
        self.reporter = make_user(roles.REPORTER, 'rita')
        # Pat's $825 check invoice, with $100 paid: $725 due (#623).
        self.invoice = self.made.i1
        self.invoice.notes = 'Promised by June'
        self.invoice.memo = 'Thanks!'
        self.invoice.save()

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

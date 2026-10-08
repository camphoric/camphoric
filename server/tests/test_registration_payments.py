'''
The registration's payment flow (SPEC §7.2, §9.7; DR-88 to DR-91): pressing a
payment button completes the registration; the server creates and captures
PayPal orders; what happens when a payment doesn't go through; and when the
confirmation is sent.
'''

import datetime
from decimal import Decimal

from django.core import mail
from django.utils import timezone
from rest_framework.test import APITestCase

from camphoric import confirmations, invoices, models, roles
from tests import paypal_mocks
from tests.factories import make_user

D = Decimal

DEPOSITS = {
    'title': 'Full Payment or Deposit',
    'oneOf': [
        {'const': '{"name": "Full Payment", "logic": {"var": ["total"]}}',
         'title': 'Full Payment'},
        {'const': '{"name": "Deposit", "logic": {"*": [{"var": ["total"]}, 0.5]}}',
         'title': '50% Deposit'},
    ],
}


class FlowTestCase(paypal_mocks.PayPalServerMixin, APITestCase):
    def setUp(self):
        super().setUp()
        organization = models.Organization.objects.create(name='Org')
        self.event = models.Event.objects.create(
            organization=organization, name='Pay Camp',
            pricing={'fee': 400},
            registration_pricing_logic=[{'var': 'total', 'exp': {'var': 'pricing.fee'}}],
            camper_pricing_logic=[],
            registration_deposit_schema=DEPOSITS,
            epayment_handling=D('2.5'),
            paypal_client_id='client',
            confirmation_email_from='camp@example.com',
        )
        response = self.post(step='registration', formData={
            'registrant_email': 'pat@example.com', 'campers': [{}]}, pricingResults={})
        self.uuid = response.data['registrationUUID']
        self.options = response.data['paymentOptions']['options']

    @property
    def registration(self):
        return models.Registration.objects.get(uuid=self.uuid)

    def post(self, status=200, **data):
        response = self.client.post(f'/api/events/{self.event.id}/register', data,
                                    format='json')
        self.assertEqual(response.status_code, status, getattr(response, 'data', None))
        return response

    def start_paypal(self, option='Full Payment', payment_type='PayPal'):
        self.reply(paypal_mocks.created())
        return self.post(step='paypal-order', registrationUUID=self.uuid,
                         paymentOption=option, paymentType=payment_type).data

    def approve(self, status=200, payment_type='PayPal'):
        return self.post(status, step='payment', registrationUUID=self.uuid,
                         paymentType=payment_type, paypalOrderId=paypal_mocks.ORDER_ID)

    def invoice(self):
        return self.registration.invoices.get()

    def confirmations(self):
        return [m for m in mail.outbox if m.to == ['pat@example.com']]


class OptionsTests(FlowTestCase):
    def test_the_server_works_out_each_option_and_its_fee(self):
        self.assertEqual(self.options, [
            {'name': 'Full Payment', 'title': 'Full Payment', 'amount': 400.0,
             'handling': 10.0},
            {'name': 'Deposit', 'title': '50% Deposit', 'amount': 200.0, 'handling': 5.0},
        ])

    def test_an_unknown_option_is_refused(self):
        self.post(400, step='payment', registrationUUID=self.uuid, paymentType='Check',
                  paymentOption='Everything')
        self.assertFalse(self.registration.completed)

    def test_no_option_means_the_default(self):
        self.post(step='payment', registrationUUID=self.uuid, paymentType='Check')
        self.assertEqual(self.registration.invoices.get().amount, D('400.00'))

    def test_the_payment_step_again(self):
        data = self.post(step='payment-step', registrationUUID=self.uuid).data
        self.assertEqual(data['paymentOptions']['options'], self.options)
        self.assertEqual(str(data['registrationUUID']), str(self.uuid))

    def test_the_payment_step_of_an_unknown_registration(self):
        self.post(404, step='payment-step', registrationUUID='00000000-0000-0000-0000-000000000000')
        self.post(404, step='payment-step', registrationUUID='nope')

    def test_the_payment_step_only_for_its_own_event(self):
        other = models.Event.objects.create(organization=self.event.organization, name='Other')
        response = self.client.post(f'/api/events/{other.id}/register', {
            'step': 'payment-step', 'registrationUUID': self.uuid}, format='json')
        self.assertEqual(response.status_code, 404)

    def test_an_out_of_date_page_is_asked_to_reload(self):
        self.post(409, step='payment', registrationUUID=self.uuid, paymentType='Check',
                  paymentData={'type': 'Full', 'total': 1})
        self.assertFalse(self.registration.completed)


class CheckTests(FlowTestCase):
    def test_pay_by_check_completes_with_an_open_invoice_and_confirms(self):
        response = self.post(step='payment', registrationUUID=self.uuid, paymentType='Check',
                             paymentOption='Deposit')
        registration = self.registration
        self.assertTrue(registration.completed)
        self.assertIsNotNone(registration.confirmation_sent_at)
        invoice = self.invoice()
        self.assertEqual((invoice.amount, invoice.handling, invoice.payment_type, invoice.status),
                         (D('200.00'), D('0.00'), 'Check', 'open'))
        self.assertEqual(response.data['ledger']['balance'], 400)
        self.assertEqual(len(self.confirmations()), 1)
        # It's in the admin lists now.
        self.assertTrue(models.Registration.objects.filter(completed=True).exists())

    def test_nothing_to_pay(self):
        self.event.pricing = {'fee': 0}
        self.event.save()
        uuid = self.post(step='registration', formData={
            'registrant_email': 'pat@example.com', 'campers': [{}]},
            pricingResults={}).data['registrationUUID']
        self.post(step='payment', registrationUUID=uuid)
        registration = models.Registration.objects.get(uuid=uuid)
        self.assertTrue(registration.completed)
        self.assertFalse(registration.invoices.exists())
        self.assertEqual(len(self.confirmations()), 1)


class PayPalTests(FlowTestCase):
    def test_the_button_completes_the_registration_unpaid(self):
        data = self.start_paypal(option='Deposit')
        self.assertEqual((data['total'], data['handling']), (205.0, 5.0))
        registration = self.registration
        self.assertTrue(registration.completed)
        self.assertIsNone(registration.confirmation_sent_at)
        invoice = self.invoice()
        # The fee isn't owed until the order is captured.
        self.assertEqual((invoice.amount, invoice.handling, invoice.pending_paypal_order_id),
                         (D('200.00'), D('0.00'), paypal_mocks.ORDER_ID))
        unit = self.paypal.requests[0]['json']['purchase_units'][0]
        self.assertEqual(unit['items'][0]['name'], f'Total for Invoice #{invoice.id} for Pay Camp')
        self.assertEqual(unit['amount']['value'], '205.00')

    def test_a_card_payment(self):
        self.start_paypal(option='Deposit', payment_type='Card')
        invoice = self.invoice()
        self.reply(paypal_mocks.order(self.registration, invoice, D('205.00'), source='card'),
                   paypal_mocks.captured(self.registration, invoice, D('205.00'), source='card'))
        self.approve(payment_type='Card')
        invoice = self.invoice()
        self.assertEqual((invoice.handling, invoice.status, invoice.payment_type),
                         (D('5.00'), 'paid', 'Card'))
        payment = invoice.payments.get()
        self.assertEqual((payment.amount, payment.payment_type), (D('205.00'), 'Card'))
        self.assertEqual(len(self.confirmations()), 1)

    def test_paypal_cancelled_then_card(self):
        # #758: PayPal's card button may report the payment as a PayPal one.
        self.start_paypal()
        self.start_paypal(payment_type='Card')
        invoice = self.invoice()
        self.reply(paypal_mocks.order(self.registration, invoice, D('410.00')),
                   paypal_mocks.captured(self.registration, invoice, D('410.00')))
        self.approve(payment_type='Card')
        invoice = self.invoice()
        self.assertEqual((invoice.status, invoice.payment_type), ('paid', 'Card'))
        self.assertEqual(invoice.payments.get().payment_type, 'Card')
        self.assertEqual(len(self.confirmations()), 1)

    def test_the_amount_changed(self):
        self.start_paypal()
        invoice = self.invoice()
        invoice.amount = D('300.00')  # a registrar changed it meanwhile
        invoice.save()
        self.reply(paypal_mocks.order(self.registration, invoice, D('410.00')))
        response = self.approve(status=409)
        self.assertEqual(response.data['code'], 'amount_changed')
        self.assertEqual(len(self.paypal.requests), 2)  # created and fetched, not captured
        self.assertFalse(models.Payment.objects.exists())
        self.assertTrue(self.registration.completed)
        self.assertEqual(self.confirmations(), [])

    def test_declined_then_pay_by_check(self):
        self.start_paypal()
        invoice = self.invoice()
        self.reply(paypal_mocks.order(self.registration, invoice, D('410.00')))
        self.paypal.add_mock_response(422, {}, {
            'name': 'UNPROCESSABLE_ENTITY', 'details': [{'issue': 'INSTRUMENT_DECLINED'}]})
        response = self.approve(status=402)
        self.assertEqual(response.data['code'], 'declined')
        self.assertEqual(self.invoice().handling, D('0.00'))

        self.post(step='payment', registrationUUID=self.uuid, paymentType='Check',
                  paymentOption='Deposit')
        invoice = self.invoice()
        self.assertEqual((invoice.amount, invoice.handling, invoice.payment_type,
                          invoice.pending_paypal_order_id), (D('200.00'), D('0.00'), 'Check', None))
        self.assertEqual(len(self.confirmations()), 1)

    def test_cancelled_then_finish_and_pay_later(self):
        self.start_paypal()
        response = self.post(step='finish', registrationUUID=self.uuid)
        self.assertEqual(response.data['ledger']['balance'], 400)
        self.assertEqual(response.data['invoice']['status'], 'open')
        self.assertEqual(len(self.confirmations()), 1)
        # #759: they haven't settled on how to pay, so it no longer says PayPal;
        # the order stays for "Check PayPal order".
        invoice = self.invoice()
        self.assertEqual((invoice.payment_type, invoice.pending_paypal_order_id),
                         (None, paypal_mocks.ORDER_ID))
        # Finishing again sends nothing more.
        self.post(step='finish', registrationUUID=self.uuid)
        self.assertEqual(len(self.confirmations()), 1)

    def test_finish_needs_a_button_pressed_first(self):
        self.post(409, step='finish', registrationUUID=self.uuid)

    def test_the_option_can_change_until_paid(self):
        self.start_paypal(option='Deposit')
        self.start_paypal(option='Full Payment')
        invoice = self.invoice()
        self.assertEqual(invoice.amount, D('400.00'))
        self.reply(paypal_mocks.order(self.registration, invoice, D('410.00')),
                   paypal_mocks.captured(self.registration, invoice, D('410.00')))
        self.approve()
        self.reply(paypal_mocks.created())
        self.post(409, step='paypal-order', registrationUUID=self.uuid,
                  paymentOption='Deposit', paymentType='PayPal')
        # A check now changes nothing: it's paid.
        self.post(step='payment', registrationUUID=self.uuid, paymentType='Check',
                  paymentOption='Deposit')
        invoice = self.invoice()
        self.assertEqual((invoice.amount, invoice.handling, invoice.payment_type),
                         (D('400.00'), D('10.00'), 'PayPal'))

    def test_an_unknown_outcome_keeps_the_order_and_emails_the_event(self):
        self.start_paypal()
        invoice = self.invoice()
        self.reply(paypal_mocks.order(self.registration, invoice, D('410.00')))
        self.paypal.add_mock_response(503, {}, {})
        response = self.approve(status=502)
        self.assertEqual(response.data['code'], 'unknown')
        invoice = self.invoice()
        self.assertEqual(invoice.pending_paypal_order_id, paypal_mocks.ORDER_ID)
        self.assertFalse(invoice.payments.exists())
        # The registrant is told not to pay again and gets their confirmation.
        self.assertEqual(len(self.confirmations()), 1)
        [report] = [m for m in mail.outbox if 'needs checking' in m.subject]
        self.assertEqual(report.to, ['camp@example.com'])
        self.assertEqual(report.subject, f'PayPal payment needs checking — Registration '
                                         f'#{self.registration.id}, Invoice #{invoice.id}')
        for text in (f'Order id: {paypal_mocks.ORDER_ID}', 'Expected: $410.00 (handling $10.00)',
                     'pat@example.com', 'Check PayPal order', 'HTTP 503',
                     f'registrations?registrationId={self.registration.id}'):
            self.assertIn(text, report.body)

        # The same problem again sends no second email.
        self.reply(paypal_mocks.order(self.registration, invoice, D('410.00')))
        self.paypal.add_mock_response(503, {}, {})
        self.approve(status=502)
        self.assertEqual(len([m for m in mail.outbox if 'needs checking' in m.subject]), 1)

        # Finishing now keeps PayPal: they may well have paid with it.
        self.post(step='finish', registrationUUID=self.uuid)
        self.assertEqual(self.invoice().payment_type, 'PayPal')

    def test_without_an_event_address_the_problem_is_logged(self):
        self.event.confirmation_email_from = ''
        self.event.save()
        self.start_paypal()
        invoice = self.invoice()
        self.reply(paypal_mocks.order(self.registration, invoice, D('410.00')))
        self.paypal.add_mock_response(503, {}, {})
        with self.assertLogs('camphoric.invoices', level='ERROR') as logs:
            self.approve(status=502)
        self.assertTrue(any('PayPal payment needs checking' in line for line in logs.output))
        self.assertFalse(models.EmailMessage.objects.filter(kind='payment_report').exists())

    def test_a_lost_capture_reply_is_recorded_on_retry(self):
        self.start_paypal()
        invoice = self.invoice()
        self.reply(paypal_mocks.order(self.registration, invoice, D('410.00')))
        self.paypal.add_mock_response(503, {}, {})
        self.approve(status=502)
        # PayPal did capture it: the retry finds it COMPLETED and records it.
        self.reply(paypal_mocks.captured(self.registration, invoice, D('410.00')))
        self.approve()
        invoice = self.invoice()
        self.assertEqual((invoice.status, invoice.handling), ('paid', D('10.00')))
        # Created, fetched, captured (lost), fetched: no second capture.
        self.assertEqual([r['method'] for r in self.paypal.requests],
                         ['POST', 'GET', 'POST', 'GET'])

    def test_an_order_for_another_registration_is_refused(self):
        self.start_paypal()
        invoice = self.invoice()
        other = paypal_mocks.order(self.registration, invoice, D('410.00'))
        other['purchase_units'][0]['reference_id'] = 'someone-else'
        self.reply(other)
        self.assertEqual(self.approve(status=400).data['code'], 'mismatch')


class RegistrarEditsTests(FlowTestCase):
    '''
    A registrar's change to the registration invoice (cancel it, lower or waive
    its amount) while nothing is paid, then the registrant replays the payment
    step from a stale tab or resumed state (#766, DR-105).
    '''

    def registrar_acts(self, method, path, data=None):
        if not hasattr(self, 'registrar'):
            self.registrar = make_user(roles.REGISTRAR, 'reggie')
        self.client.force_authenticate(self.registrar)
        response = getattr(self.client, method)(path, data, format='json')
        self.client.force_authenticate(None)
        self.assertLess(response.status_code, 300, getattr(response, 'data', None))

    def open_unpaid_invoice(self):
        self.start_paypal(option='Full Payment')
        return self.invoice()

    def test_a_cancelled_invoice_stays_cancelled_when_paypal_is_replayed(self):
        invoice = self.open_unpaid_invoice()
        self.registrar_acts('post', f'/api/invoices/{invoice.id}/cancel/',
                            {'reason': 'Waived'})
        response = self.post(409, step='paypal-order', registrationUUID=self.uuid,
                             paymentOption='Deposit', paymentType='PayPal')
        self.assertEqual(response.data['code'], 'cancelled')
        self.assertIsNotNone(self.invoice().cancelled_at)
        self.assertEqual(len(self.paypal.requests), 1)  # only the first order

    def test_a_cancelled_invoice_stays_cancelled_when_a_check_is_replayed(self):
        invoice = self.open_unpaid_invoice()
        self.registrar_acts('post', f'/api/invoices/{invoice.id}/cancel/',
                            {'reason': 'Waived'})
        response = self.post(409, step='payment', registrationUUID=self.uuid,
                             paymentType='Check', paymentOption='Deposit')
        self.assertEqual(response.data['code'], 'cancelled')
        self.assertIsNotNone(self.invoice().cancelled_at)
        self.assertEqual(self.confirmations(), [])

    def lowered_to_100(self):
        invoice = self.open_unpaid_invoice()
        self.registrar_acts('patch', f'/api/invoices/{invoice.id}/', {'amount': '100.00'})
        return invoice

    def test_a_stale_page_is_sent_the_registrars_amount(self):
        # Loaded before the registrar's change, the page still offers the Deposit.
        invoice = self.lowered_to_100()
        for step in ({'step': 'paypal-order', 'paymentType': 'PayPal'},
                     {'step': 'payment', 'paymentType': 'Check'}):
            with self.subTest(step=step['step']):
                response = self.post(409, registrationUUID=self.uuid, paymentOption='Deposit',
                                     **step)
                self.assertEqual(response.data['code'], 'invoice_changed')
                self.assertEqual(response.data['paymentStep']['paymentOptions']['options'], [{
                    'name': f'invoice:{invoice.id}', 'title': 'Full Payment',
                    'amount': 100.0, 'handling': 2.5}])
        invoice = self.invoice()
        self.assertEqual((invoice.amount, invoice.payment_type), (D('100.00'), 'PayPal'))
        self.assertEqual(len(self.paypal.requests), 1)  # only the first order
        self.assertEqual(self.confirmations(), [])

    def test_a_reopened_page_shows_the_registrars_amount(self):
        invoice = self.lowered_to_100()
        data = self.post(step='payment-step', registrationUUID=self.uuid).data
        self.assertEqual(data['paymentOptions']['default'], f'invoice:{invoice.id}')
        self.assertEqual([o['amount'] for o in data['paymentOptions']['options']], [100.0])

    def test_paying_the_registrars_amount_online(self):
        invoice = self.lowered_to_100()
        data = self.start_paypal(option=f'invoice:{invoice.id}')
        self.assertEqual((data['total'], data['handling']), (102.5, 2.5))
        unit = self.paypal.requests[-1]['json']['purchase_units'][0]
        self.assertEqual(unit['amount']['value'], '102.50')
        invoice = self.invoice()
        self.assertEqual((invoice.amount, invoice.description), (D('100.00'), 'Full Payment'))

    def test_paying_the_registrars_amount_by_check(self):
        invoice = self.lowered_to_100()
        self.post(step='payment', registrationUUID=self.uuid, paymentType='Check',
                  paymentOption=f'invoice:{invoice.id}')
        invoice = self.invoice()
        self.assertEqual((invoice.amount, invoice.payment_type, invoice.pending_paypal_order_id),
                         (D('100.00'), 'Check', None))
        self.assertEqual(len(self.confirmations()), 1)

    def test_cancelled_after_the_page_showed_the_registrars_amount(self):
        invoice = self.lowered_to_100()
        self.registrar_acts('post', f'/api/invoices/{invoice.id}/cancel/')
        data = self.post(step='payment-step', registrationUUID=self.uuid).data
        self.assertTrue(data['invoiceCancelled'])
        for step in ({'step': 'paypal-order', 'paymentType': 'PayPal'},
                     {'step': 'payment', 'paymentType': 'Check'}):
            with self.subTest(step=step['step']):
                response = self.post(409, registrationUUID=self.uuid,
                                     paymentOption=f'invoice:{invoice.id}', **step)
                self.assertEqual(response.data['code'], 'cancelled')
        self.assertIsNotNone(self.invoice().cancelled_at)

    def test_a_change_between_choosing_and_paying_is_caught(self):
        # The organizer's change lands after the option was chosen, before the
        # invoice is locked: it's refused there, as at the choosing (DR-105).
        self.lowered_to_100()
        deposit = invoices.PaymentOption(name='Deposit', title='50% Deposit',
                                         amount=D('200.00'), handling=D('5.00'))
        with self.assertRaises(invoices.PaymentProblem) as caught:
            invoices.prepare_registration_invoice(self.registration, deposit, 'Check')
        self.assertEqual(caught.exception.code, 'invoice_changed')
        self.assertEqual(self.invoice().amount, D('100.00'))

    def test_a_reopened_invoice_is_the_option(self):
        invoice = self.open_unpaid_invoice()
        self.registrar_acts('post', f'/api/invoices/{invoice.id}/cancel/')
        self.registrar_acts('post', f'/api/invoices/{invoice.id}/reopen/')
        self.post(409, step='paypal-order', registrationUUID=self.uuid, paymentOption='Deposit',
                  paymentType='PayPal')
        self.start_paypal(option=f'invoice:{invoice.id}')
        invoice = self.invoice()
        self.assertEqual((invoice.amount, invoice.cancelled_at), (D('400.00'), None))

    def test_a_new_description_alone_sticks(self):
        invoice = self.open_unpaid_invoice()
        self.registrar_acts('patch', f'/api/invoices/{invoice.id}/',
                            {'description': 'Registration (sliding scale)'})
        self.start_paypal(option=f'invoice:{invoice.id}')
        invoice = self.invoice()
        self.assertEqual((invoice.amount, invoice.description),
                         (D('400.00'), 'Registration (sliding scale)'))

    def test_the_edit_form_sending_back_unchanged_fields_isnt_a_change(self):
        invoice = self.open_unpaid_invoice()
        self.registrar_acts('patch', f'/api/invoices/{invoice.id}/', {
            'description': ' Full Payment ', 'amount': '400.00', 'handling': '0.00',
            'memo': 'See you at camp'})
        self.assertIsNone(self.invoice().organizer_changed_at)

    def test_a_memo_or_due_date_leaves_the_option_free_to_change(self):
        invoice = self.open_unpaid_invoice()
        self.registrar_acts('patch', f'/api/invoices/{invoice.id}/',
                            {'memo': 'See you at camp', 'due_on': '2026-11-15'})
        self.assertIsNone(self.invoice().organizer_changed_at)
        self.start_paypal(option='Deposit')
        invoice = self.invoice()
        self.assertEqual((invoice.amount, invoice.memo), (D('200.00'), 'See you at camp'))


class ConfirmationSweepTests(FlowTestCase):
    def test_a_closed_tab_gets_its_confirmation_after_half_an_hour(self):
        self.start_paypal()
        self.assertEqual(confirmations.send_overdue_confirmations(), 0)
        later = timezone.now() + datetime.timedelta(minutes=31)
        self.assertEqual(confirmations.send_overdue_confirmations(later), 1)
        self.assertEqual(len(self.confirmations()), 1)
        self.assertIsNone(self.invoice().payment_type)  # #759
        self.assertEqual(confirmations.send_overdue_confirmations(later), 0)

    def test_a_walked_away_confirmation_doesnt_say_paypal(self):
        # #763 (wiki A10): pressed PayPal, closed the window and left.
        template = self.event.confirmation_template
        template.body = ('Paying by {{ invoice.payment_type or "nothing yet" }}; '
                         'chose {{ registration.payment_type or "nothing" }}.')
        template.save()
        self.start_paypal()
        later = timezone.now() + datetime.timedelta(minutes=31)
        confirmations.send_overdue_confirmations(later)
        [email] = self.confirmations()
        self.assertIn('Paying by nothing yet; chose nothing.', email.body)

    def test_registrations_confirmed_before_the_sweep_are_left_alone(self):
        models.Registration.objects.filter(uuid=self.uuid).update(
            completed=True, completed_at=timezone.now() - datetime.timedelta(days=9),
            confirmation_sent_at=timezone.now() - datetime.timedelta(days=9))
        later = timezone.now() + datetime.timedelta(minutes=31)
        self.assertEqual(confirmations.send_overdue_confirmations(later), 0)
        self.assertEqual(self.confirmations(), [])

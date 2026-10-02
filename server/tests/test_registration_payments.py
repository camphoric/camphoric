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

from camphoric import confirmations, models
from tests import paypal_mocks

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


class ConfirmationSweepTests(FlowTestCase):
    def test_a_closed_tab_gets_its_confirmation_after_half_an_hour(self):
        self.start_paypal()
        self.assertEqual(confirmations.send_overdue_confirmations(), 0)
        later = timezone.now() + datetime.timedelta(minutes=31)
        self.assertEqual(confirmations.send_overdue_confirmations(later), 1)
        self.assertEqual(len(self.confirmations()), 1)
        self.assertEqual(confirmations.send_overdue_confirmations(later), 0)

    def test_registrations_confirmed_before_the_sweep_are_left_alone(self):
        models.Registration.objects.filter(uuid=self.uuid).update(
            completed=True, completed_at=timezone.now() - datetime.timedelta(days=9),
            confirmation_sent_at=timezone.now() - datetime.timedelta(days=9))
        later = timezone.now() + datetime.timedelta(minutes=31)
        self.assertEqual(confirmations.send_overdue_confirmations(later), 0)
        self.assertEqual(self.confirmations(), [])

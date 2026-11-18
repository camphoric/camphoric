'''
The Payments area's "needs attention" list (SPEC §8.11; DR-168): each kind,
and the cases that must not appear — a balance of 0, a refund already given,
an invoice PayPal may yet record a payment on.
'''

from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from camphoric import models, roles
from camphoric.payments_attention import PAYPAL_REFUND_WINDOW
from tests.factories import create_template_event, make_user

D = Decimal


class PaymentsAttentionTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()
        cls.registrar = make_user(roles.REGISTRAR, 'reggie')
        cls.reporter = make_user(roles.REPORTER, 'rita')

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.registrar)
        self.today = timezone.localdate()

    def items(self, status=200):
        response = self.client.get(f'/api/events/{self.made.event.id}/payments-attention/')
        self.assertEqual(response.status_code, status, getattr(response, 'data', None))
        return response.data

    def of(self, registration, kind=None):
        return [item for item in self.items() if item['registration'] == registration.id
                and (kind is None or item['kind'] == kind)]

    def pay(self, registration, amount, **fields):
        return models.Payment.objects.create(
            registration=registration, amount=D(amount), paid_on=self.today,
            payment_type=fields.pop('payment_type', 'Check'), **fields)

    # The template event: r1 owes $725 of its $825, all asked by its invoice;
    # r2 paid $450.50 by PayPal on a $400 invoice, so it's owed $50.50.

    def test_a_balance_of_0_with_everything_asked_isnt_listed(self):
        self.pay(self.made.r1, '725.00', invoice=self.made.i1)
        self.assertEqual(self.of(self.made.r1), [])

    def test_a_registration_owing_what_its_invoice_asks_isnt_listed(self):
        self.assertEqual(self.of(self.made.r1), [])

    def test_a_refund_due_is_listed_once_on_its_overpaid_invoice(self):
        [item] = self.of(self.made.r2)
        self.assertEqual(item, {
            'kind': 'refund_due',
            'registration': self.made.r2.id,
            'registrant_email': 'lee@example.com',
            'campers': ['Lee Beta'],
            'invoice': self.made.i2.id,
            'amount': '50.50',
            'due_on': None,
            'payment': None,
            # Its PayPal payments have no capture to refund.
            'paypal_refund': False,
            'paypal_processing': False,
        })

    def test_a_refund_already_given_isnt_listed(self):
        payment = self.made.i2.payments.order_by('-amount').first()
        self.pay(self.made.r2, '-50.50', invoice=self.made.i2, refund_of=payment)
        self.assertEqual(self.of(self.made.r2), [])

    def test_a_refund_due_says_when_it_can_go_back_through_paypal(self):
        payment = self.made.i2.payments.order_by('-amount').first()
        payment.paypal_transaction_id = 'CAPTURE-1'
        payment.paid_on = self.today - timedelta(days=10)
        payment.save()
        [item] = self.of(self.made.r2, 'refund_due')
        self.assertEqual((item['paypal_refund'], item['payment']), (True, payment.id))

    def test_not_through_paypal_after_180_days(self):
        payment = self.made.i2.payments.order_by('-amount').first()
        payment.paypal_transaction_id = 'CAPTURE-1'
        payment.paid_on = self.today - PAYPAL_REFUND_WINDOW - timedelta(days=1)
        payment.save()
        [item] = self.of(self.made.r2, 'refund_due')
        self.assertEqual((item['paypal_refund'], item['payment']), (False, None))

    def test_not_through_paypal_once_that_payment_is_refunded(self):
        payment = self.made.i2.payments.order_by('-amount').first()  # $250.50
        payment.paypal_transaction_id = 'CAPTURE-1'
        payment.save()
        self.pay(self.made.r2, '300.00', invoice=self.made.i2)
        # Its PayPal payment refunded in full by hand: $750.50 − $250.50 paid on $400.
        self.pay(self.made.r2, '-250.50', invoice=self.made.i2, refund_of=payment)
        [item] = self.of(self.made.r2, 'refund_due')
        self.assertEqual((item['amount'], item['paypal_refund']), ('100.00', False))

    def test_an_overpaid_invoice_on_a_registration_that_still_owes(self):
        extra = models.Invoice.objects.create(
            registration=self.made.r1, origin='admin', description='Linens', amount=D('50.00'))
        self.pay(self.made.r1, '80.00', invoice=extra)
        [item] = self.of(self.made.r1)
        self.assertEqual((item['kind'], item['invoice'], item['amount']),
                         ('overpaid_invoice', extra.id, '30.00'))

    def test_money_no_invoice_asks_for(self):
        self.made.i1.amount = D('400.00')
        self.made.i1.save()
        [item] = self.of(self.made.r1)
        self.assertEqual((item['kind'], item['invoice'], item['amount']),
                         ('not_invoiced', None, '425.00'))

    def test_past_due(self):
        self.made.i1.due_on = self.today - timedelta(days=1)
        self.made.i1.save()
        [item] = self.of(self.made.r1)
        self.assertEqual((item['kind'], item['invoice'], item['amount'], item['due_on']),
                         ('past_due', self.made.i1.id, '725.00', self.made.i1.due_on))

    def test_not_past_due_on_its_due_date_or_once_paid_or_cancelled(self):
        self.made.i1.due_on = self.today
        self.made.i1.save()
        self.assertEqual(self.of(self.made.r1), [])

        paid = models.Invoice.objects.create(
            registration=self.made.r1, origin='admin', amount=D('10.00'),
            due_on=self.today - timedelta(days=5))
        self.pay(self.made.r1, '10.00', invoice=paid)
        cancelled = models.Invoice.objects.create(
            registration=self.made.r1, origin='admin', amount=D('10.00'),
            due_on=self.today - timedelta(days=5), cancelled_at=timezone.now())
        kinds = [(item['kind'], item['invoice']) for item in self.of(self.made.r1)]
        self.assertNotIn(('past_due', paid.id), kinds)
        self.assertNotIn(('past_due', cancelled.id), kinds)

    def test_an_online_payment_not_finished(self):
        self.made.i1.payments.all().delete()
        self.made.i1.pending_paypal_order_id = 'ORDER-1'
        self.made.i1.save()
        [item] = self.of(self.made.r1)
        self.assertEqual(
            (item['kind'], item['invoice'], item['amount'], item['paypal_processing']),
            ('online_unfinished', self.made.i1.id, '825.00', False))

    def test_not_an_order_paypal_may_yet_record(self):
        self.made.i1.payments.all().delete()
        self.made.i1.pending_paypal_order_id = 'ORDER-1'
        self.made.i1.paypal_capture_order_id = 'ORDER-1'
        self.made.i1.paypal_capture_started_at = timezone.now()
        self.made.i1.due_on = self.today - timedelta(days=1)
        self.made.i1.save()
        # Held, it isn't past due either: its payment is on its way.
        self.assertEqual(self.of(self.made.r1), [])

    def test_paypal_processing_longer_than_the_worker_asks(self):
        long_ago = timezone.now() - timedelta(days=40)
        self.made.i1.paypal_capture_order_id = 'ORDER-1'
        self.made.i1.paypal_capture_started_at = long_ago
        self.made.i1.paypal_capture_pending_at = long_ago + timedelta(days=30)
        self.made.i1.save()
        [item] = self.of(self.made.r1)
        self.assertEqual((item['kind'], item['invoice'], item['paypal_processing']),
                         ('online_unfinished', self.made.i1.id, True))

    def test_deleted_registrations_and_other_events_arent_listed(self):
        self.made.r2.soft_delete()
        self.assertEqual(self.of(self.made.r2), [])
        other = models.Event.objects.create(organization=self.made.organization, name='Other')
        unbilled = models.Registration.objects.create(
            event=other, registrant_email='o@example.com', server_pricing_results={'total': 100})
        self.assertEqual(self.of(unbilled), [])

    def test_listed_by_kind(self):
        self.made.i1.amount = D('400.00')
        self.made.i1.due_on = self.today - timedelta(days=1)
        self.made.i1.save()
        self.assertEqual([item['kind'] for item in self.items()],
                         ['refund_due', 'not_invoiced', 'past_due'])

    def test_reporters_read_it(self):
        self.client.force_authenticate(self.reporter)
        self.assertEqual(len(self.items()), 1)

    def test_signed_out_is_refused(self):
        self.client.force_authenticate(None)
        self.items(status=401)

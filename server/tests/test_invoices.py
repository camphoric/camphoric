'''
Invoices, payments and refunds (SPEC §9.7; DR-87, DR-88, DR-93, DR-94): the
ledger, where a payment goes, the "Payment received" invoice, payment options,
who may cancel and delete, and refunds — by hand and through PayPal.
'''

from decimal import Decimal
import threading
from unittest import mock
import uuid

from django.core import mail
from django.db import connection, DatabaseError
from django.test import TransactionTestCase
from rest_framework.test import APIClient, APITestCase

from camphoric import invoices, models, roles
from tests import paypal_mocks
from tests.factories import create_template_event, make_user, registration_invoice

D = Decimal


class InvoiceTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()
        cls.registrar = make_user(roles.REGISTRAR, 'reggie')
        cls.admin = make_user(roles.ADMIN, 'boss')
        cls.reporter = make_user(roles.REPORTER, 'rita')

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.registrar)

    def ledger(self, registration):
        return invoices.ledger(models.Registration.objects.get(pk=registration.pk))

    def record(self, status=201, **data):
        response = self.client.post('/api/payments/', {
            'payment_type': 'Check', 'attributes': {}, **data}, format='json')
        self.assertEqual(response.status_code, status, response.data)
        return response.data

    def invoice(self, invoice):
        return models.Invoice.all_objects.get(pk=invoice.pk if hasattr(invoice, 'pk') else invoice)


class LedgerTests(InvoiceTestCase):
    def test_owed_is_the_price_plus_handling_and_paid_is_net(self):
        r1 = self.made.r1  # $825, $100 paid by check on its $825 invoice
        ledger = self.ledger(r1)
        self.assertEqual((ledger.price, ledger.total_owed, ledger.total_paid, ledger.balance),
                         (D('825.00'), D('825.00'), D('100.00'), D('725.00')))
        self.assertEqual(ledger.uninvoiced_balance, D('0.00'))

        self.made.i1.handling = D('5.00')
        self.made.i1.save()
        ledger = self.ledger(r1)
        self.assertEqual((ledger.handling_charges, ledger.total_owed, ledger.balance),
                         (D('5.00'), D('830.00'), D('730.00')))

    def test_cancelled_invoices_charge_no_handling(self):
        invoice = models.Invoice.objects.create(
            registration=self.made.r1, origin='admin', amount=D('10'), handling=D('3'),
            cancelled_at='2026-10-01T00:00:00Z')
        self.assertEqual(self.ledger(self.made.r1).handling_charges, D('0.00'))
        self.assertEqual(invoice.status, 'cancelled')

    def test_uninvoiced_balance(self):
        r1 = self.made.r1
        self.made.i1.amount = D('400.00')
        self.made.i1.save()
        # $825 owed, $100 paid, $300 still asked by the invoice: $425 not asked by any.
        self.assertEqual(self.ledger(r1).uninvoiced_balance, D('425.00'))

    def test_the_api_shows_the_ledger(self):
        response = self.client.get('/api/registrations/', {'event': self.made.event.id})
        rows = {row['id']: row for row in response.data}
        self.assertEqual(rows[self.made.r1.id]['balance'], 725.0)
        self.assertEqual(rows[self.made.r2.id]['balance'], -50.5)
        self.assertNotIn('payment_type', rows[self.made.r1.id])
        response = self.client.get(f'/api/registrations/{self.made.r1.id}/')
        self.assertEqual(response.data['total_owed'], 825.0)


class StatusTests(InvoiceTestCase):
    def test_two_checks_pay_one_invoice(self):
        r1, invoice = self.made.r1, self.made.i1  # $825, $100 paid
        self.assertEqual(self.invoice(invoice).status, 'partially_paid')
        self.record(registration=r1.id, amount='725.00')
        invoice = self.invoice(invoice)
        self.assertEqual((invoice.status, invoice.amount_due), ('paid', D('0.00')))
        self.assertEqual(r1.invoices.count(), 1)

    def test_an_overpayment(self):
        invoice = self.invoice(self.made.i2)  # $400, paid $450.50
        self.assertEqual((invoice.status, invoice.overpaid), ('overpaid', D('50.50')))
        self.assertEqual(self.ledger(self.made.r2).balance, D('-50.50'))

    def test_the_serializer(self):
        data = self.client.get(f'/api/invoices/{self.made.i1.id}/').data
        self.assertEqual((data['total'], data['amount_paid'], data['amount_due'], data['status']),
                         ('825.00', '100.00', '725.00', 'partially_paid'))
        self.assertNotIn('token', data)


class WhereAPaymentGoesTests(InvoiceTestCase):
    def test_the_oldest_invoice_with_money_due(self):
        data = self.record(registration=self.made.r1.id, amount='50.00')
        self.assertEqual(data['invoice'], self.made.i1.id)

    def test_a_named_invoice(self):
        other = models.Invoice.objects.create(
            registration=self.made.r1, origin='admin', amount=D('30'))
        data = self.record(invoice=other.id, amount='30.00')
        self.assertEqual(data['registration'], self.made.r1.id)
        self.assertEqual(self.invoice(other).status, 'paid')

    def test_with_nothing_due_a_payment_received_invoice(self):
        data = self.record(registration=self.made.r2.id, amount='25.00', notes='Donation')
        invoice = models.Invoice.objects.get(pk=data['invoice'])
        self.assertEqual((invoice.origin, invoice.description, invoice.amount, invoice.status),
                         ('payment_received', 'Payment received', D('25.00'), 'paid'))
        self.assertEqual(invoice.created_by, self.registrar)

    def test_new_invoice_asks_for_one(self):
        data = self.record(registration=self.made.r1.id, amount='10.00', new_invoice=True)
        self.assertNotEqual(data['invoice'], self.made.i1.id)

    def test_not_another_registrations_invoice_nor_a_cancelled_one(self):
        self.record(400, registration=self.made.r1.id, invoice=self.made.i2.id, amount='1')
        cancelled = models.Invoice.objects.create(
            registration=self.made.r1, origin='admin', amount=D('5'),
            cancelled_at='2026-10-01T00:00:00Z')
        self.record(400, invoice=cancelled.id, amount='5')

    def test_a_payment_received_invoice_follows_its_payment(self):
        data = self.record(registration=self.made.r2.id, amount='20.00')
        invoice_id = data['invoice']
        response = self.client.patch(f'/api/payments/{data["id"]}/', {'amount': '200.00'},
                                     format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.invoice(invoice_id).amount, D('200.00'))

        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(f'/api/payments/{data["id"]}/').status_code, 204)
        invoice = self.invoice(invoice_id)
        self.assertEqual(invoice.status, 'cancelled')
        self.client.force_authenticate(self.registrar)
        response = self.client.post(f'/api/payments/{data["id"]}/restore/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.invoice(invoice_id).status, 'paid')

    def test_payments_saved_without_an_invoice_still_get_one(self):
        payment = models.Payment.objects.create(registration=self.made.r1, amount=D('5'))
        self.assertEqual(payment.invoice, self.made.i1)


class RefundTests(InvoiceTestCase):
    def payment(self):
        return models.Payment.objects.filter(registration=self.made.r1).get()

    def test_a_refund_by_hand(self):
        payment = self.payment()
        data = self.record(refund_of=payment.id, amount='-40.00', payment_type='Check',
                           notes='Check mailed back')
        self.assertEqual((data['invoice'], data['registration']), (self.made.i1.id,
                                                                   self.made.r1.id))
        self.assertEqual(self.ledger(self.made.r1).total_paid, D('60.00'))
        listed = self.client.get(f'/api/payments/{payment.id}/').data
        self.assertEqual(listed['refunded'], '40.00')

    def test_no_more_than_was_paid(self):
        payment = self.payment()
        self.record(400, refund_of=payment.id, amount='-100.01')
        self.record(400, refund_of=payment.id, amount='40.00')
        self.record(refund_of=payment.id, amount='-60.00')
        self.record(400, refund_of=payment.id, amount='-40.01')

    def test_a_refund_names_its_invoice(self):
        self.record(400, registration=self.made.r1.id, amount='-5.00')
        data = self.record(invoice=self.made.i1.id, amount='-5.00')
        self.assertTrue(models.Payment.objects.get(pk=data['id']).is_refund)

    def test_a_refunded_payment_received_invoice_nets_to_nothing(self):
        data = self.record(registration=self.made.r2.id, amount='20.00')
        self.record(refund_of=data['id'], amount='-20.00')
        invoice = self.invoice(data['invoice'])
        self.assertEqual((invoice.amount, invoice.amount_due, invoice.status),
                         (D('0.00'), D('0.00'), 'paid'))

    def test_a_refunded_payment_cant_be_deleted(self):
        payment = self.payment()
        self.record(refund_of=payment.id, amount='-10.00')
        self.client.force_authenticate(self.admin)
        preview = self.client.get(f'/api/payments/{payment.id}/delete-preview/').data
        self.assertFalse(preview['can_delete'])
        self.assertEqual(self.client.delete(f'/api/payments/{payment.id}/').status_code, 409)


class EditingAPaymentTests(InvoiceTestCase):
    '''An edit can't contradict the payment's refunds or its PayPal capture (#767).'''

    def edit(self, payment, status=200, **data):
        response = self.client.patch(f'/api/payments/{payment.id}/', data, format='json')
        self.assertEqual(response.status_code, status, response.data)
        return response.data

    def test_not_below_what_was_refunded(self):
        payment = models.Payment.objects.filter(registration=self.made.r1).get()
        self.record(refund_of=payment.id, amount='-80.00')
        data = self.edit(payment, 400, amount='50.00')
        self.assertIn('$80.00', str(data['amount']))
        self.edit(payment, amount='80.00')
        self.assertEqual(self.ledger(self.made.r1).total_paid, D('0.00'))

    def test_a_refund_stays_with_its_payment_and_invoice(self):
        payment = models.Payment.objects.filter(registration=self.made.r1).get()
        refund = models.Payment.objects.get(pk=self.record(refund_of=payment.id,
                                                           amount='-80.00')['id'])
        self.edit(refund, 400, refund_of=None)
        other = models.Invoice.objects.create(
            registration=self.made.r1, origin='admin', amount=D('30'))
        self.edit(payment, 400, invoice=other.id)
        self.edit(refund, refund_of=payment.id, notes='Check mailed back')

    def test_a_refund_isnt_restored_beyond_what_is_left(self):
        payment = models.Payment.objects.filter(registration=self.made.r1).get()
        refund_id = self.record(refund_of=payment.id, amount='-80.00')['id']
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(f'/api/payments/{refund_id}/').status_code, 204)
        self.edit(payment, amount='50.00')
        response = self.client.post(f'/api/payments/{refund_id}/restore/')
        self.assertEqual(response.status_code, 409, response.data)
        self.edit(payment, amount='100.00')
        response = self.client.post(f'/api/payments/{refund_id}/restore/')
        self.assertEqual(response.status_code, 200, response.data)

    def test_a_refund_isnt_restored_while_its_payment_is_deleted(self):
        payment = models.Payment.objects.filter(registration=self.made.r1).get()
        refund_id = self.record(refund_of=payment.id, amount='-80.00')['id']
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(f'/api/payments/{refund_id}/').status_code, 204)
        self.assertEqual(self.client.delete(f'/api/payments/{payment.id}/').status_code, 204)
        response = self.client.post(f'/api/payments/{refund_id}/restore/')
        self.assertEqual(response.status_code, 409, response.data)
        self.assertIn('Restore its payment first', response.data['detail'])
        self.assertEqual(self.ledger(self.made.r1).total_paid, D('0.00'))
        self.assertEqual(self.client.post(f'/api/payments/{payment.id}/restore/').status_code,
                         200)
        response = self.client.post(f'/api/payments/{refund_id}/restore/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.ledger(self.made.r1).total_paid, D('20.00'))

    def test_a_paypal_payments_amount_and_type_are_paypals(self):
        invoice = registration_invoice(self.made.r2, 'PayPal', D('100.00'))
        payment = models.Payment.objects.create(
            registration=self.made.r2, invoice=invoice, payment_type='PayPal',
            amount=D('102.50'), paypal_transaction_id=paypal_mocks.CAPTURE_ID)
        self.edit(payment, 400, amount='50.00')
        self.edit(payment, 400, payment_type='Check')
        self.edit(payment, payment_type='Card')  # PayPal can report a card as PayPal (#758)
        self.edit(payment, payment_type='PayPal')
        # The edit form sends them back unchanged with the rest.
        self.edit(payment, amount='102.50', payment_type='PayPal', notes='Paid at the door')
        payment.refresh_from_db()
        self.assertEqual((payment.amount, payment.payment_type, payment.notes),
                         (D('102.50'), 'PayPal', 'Paid at the door'))


class CancelAndDeleteTests(InvoiceTestCase):
    def test_registrars_cancel_and_reopen(self):
        invoice = models.Invoice.objects.create(
            registration=self.made.r1, origin='admin', amount=D('30'))
        response = self.client.post(f'/api/invoices/{invoice.id}/cancel/',
                                    {'reason': 'Waived'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual((response.data['status'], response.data['cancel_reason']),
                         ('cancelled', 'Waived'))
        response = self.client.post(f'/api/invoices/{invoice.id}/reopen/')
        self.assertEqual(response.data['status'], 'open')

    def test_not_while_it_holds_money(self):
        response = self.client.post(f'/api/invoices/{self.made.i1.id}/cancel/')
        self.assertEqual(response.status_code, 409)
        payment = models.Payment.objects.filter(registration=self.made.r1).get()
        self.record(refund_of=payment.id, amount='-100.00')
        response = self.client.post(f'/api/invoices/{self.made.i1.id}/cancel/')
        self.assertEqual(response.status_code, 200, response.data)

    def test_only_admins_delete_and_only_an_invoice_with_no_payments(self):
        empty = models.Invoice.objects.create(
            registration=self.made.r1, origin='admin', amount=D('30'))
        self.assertEqual(self.client.delete(f'/api/invoices/{empty.id}/').status_code, 403)
        self.client.force_authenticate(self.admin)
        response = self.client.delete(f'/api/invoices/{self.made.i1.id}/')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.client.delete(f'/api/invoices/{empty.id}/').status_code, 204)

    def test_the_registrations_own_invoice_is_cancelled_not_deleted(self):
        # Deleted, a registrant's payment page would make it again (DR-105).
        own = models.Invoice.objects.create(
            registration=self.made.r2, origin='registration', amount=D('30'))
        self.client.force_authenticate(self.admin)
        preview = self.client.get(f'/api/invoices/{own.id}/delete-preview/').data
        self.assertIn('Cancel it instead', str(preview))
        self.assertEqual(self.client.delete(f'/api/invoices/{own.id}/').status_code, 409)
        self.assertTrue(models.Invoice.objects.filter(pk=own.pk).exists())

    def test_only_admins_delete_payments(self):
        payment = models.Payment.objects.filter(registration=self.made.r1).get()
        self.assertEqual(self.client.delete(f'/api/payments/{payment.id}/').status_code, 403)

    def test_reporters_read_notes_but_dont_edit(self):
        self.made.i1.notes = 'Promised by June'
        self.made.i1.save()
        self.client.force_authenticate(self.reporter)
        response = self.client.get(f'/api/invoices/{self.made.i1.id}/')
        self.assertEqual(response.data['notes'], 'Promised by June')
        response = self.client.patch(f'/api/invoices/{self.made.i1.id}/', {'notes': 'x'},
                                     format='json')
        self.assertEqual(response.status_code, 403)

    def test_registrars_edit_the_handling_fee_and_amount(self):
        response = self.client.patch(f'/api/invoices/{self.made.i1.id}/',
                                     {'handling': '4.25', 'amount': '800.00'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['total'], '804.25')
        response = self.client.patch(f'/api/invoices/{self.made.i1.id}/', {'handling': '-1'},
                                     format='json')
        self.assertEqual(response.status_code, 400)


class PaymentOptionTests(APITestCase):
    def setUp(self):
        self.event = models.Event(name='Options Camp', paypal_enabled=True,
                                  epayment_handling=D('2.5'))

    def options(self, schema, results):
        self.event.registration_deposit_schema = schema
        return invoices.payment_options(self.event, results)

    LARK = {
        'title': 'Full Payment or Deposit Only',
        'description': 'Pay in full or a deposit.',
        'oneOf': [
            {'const': '{"name": "Full Payment", "logic": {"var": ["total"]}}',
             'title': 'Full Payment'},
            {'const': '{"name": "50% Deposit", "logic": {"+": [{"var": ["total"]}, '
                      '{"*": [{"var": ["tuition", 0]}, -0.5]}, '
                      '{"*": [{"var": ["meals", 0]}, -0.5]}]}}',
             'title': '50% Deposit'},
        ],
        'default': '{"name": "Full Payment", "logic": {"var": ["total"]}}',
    }

    def test_lark_deposit(self):
        meta, options = self.options(self.LARK, {'total': 1000, 'tuition': 700, 'meals': 200})
        self.assertEqual(meta, {'title': 'Full Payment or Deposit Only',
                                'description': 'Pay in full or a deposit.',
                                'default': 'Full Payment'})
        self.assertEqual([(o.name, o.amount, o.handling) for o in options], [
            ('Full Payment', D('1000.00'), D('25.00')),
            ('50% Deposit', D('550.00'), D('13.75')),
        ])

    def test_family_week_per_camper(self):
        schema = {'oneOf': [
            {'const': '{"name": "Deposit", "logic": {"*": [50, {"reduce": [{"var": "campers"}, '
                      '{"+": [1, {"var": "accumulator"}]}, 0]}]}}', 'title': '$50 per camper'},
        ]}
        _, [option] = self.options(schema, {'total': 600, 'campers': [{}, {}, {}]})
        self.assertEqual((option.title, option.amount), ('$50 per camper', D('150.00')))

    def test_within_nothing_and_the_total(self):
        schema = {'oneOf': [
            {'const': '{"name": "Too much", "logic": 5000}'},
            {'const': '{"name": "Negative", "logic": -5}'},
            {'const': '{"name": "Words", "logic": "free"}'},
            {'const': 'not json'},
        ]}
        _, options = self.options(schema, {'total': 100})
        self.assertEqual([(o.name, o.amount) for o in options],
                         [('Too much', D('100.00')), ('Negative', D('0.00')),
                          ('Words', D('100.00'))])

    def test_enum_schemas_and_none(self):
        schema = {'enum': ['{"name": "Full", "logic": {"var": ["total"]}}'],
                  'enumNames': ['Pay in full']}
        _, [option] = self.options(schema, {'total': 80})
        self.assertEqual((option.name, option.title, option.amount), ('Full', 'Pay in full',
                                                                      D('80.00')))
        meta, [option] = self.options(None, {'total': 80})
        self.assertEqual((meta['default'], option.name, option.amount),
                         ('Full payment', 'Full payment', D('80.00')))

    def test_no_fee_without_paypal(self):
        self.event.paypal_enabled = False
        _, [option] = self.options(None, {'total': 80})
        self.assertEqual(option.handling, D('0.00'))


class PayPalTestCase(paypal_mocks.PayPalServerMixin, InvoiceTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        event = cls.made.event
        event.paypal_client_id = 'client'
        event.epayment_handling = D('2.5')
        event.save()


class CheckPayPalOrderTests(PayPalTestCase):
    def test_a_captured_order_is_recorded_once(self):
        invoice = registration_invoice(self.made.r1, 'PayPal', D('40.00'))
        invoice.pending_paypal_order_id = paypal_mocks.ORDER_ID
        invoice.save()
        captured = paypal_mocks.captured(self.made.r1, invoice, D('41.00'))
        self.reply(captured)
        response = self.client.post(f'/api/invoices/{invoice.id}/check-paypal/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['result'], 'recorded')
        invoice = self.invoice(invoice)
        self.assertEqual((invoice.handling, invoice.status, invoice.pending_paypal_order_id),
                         (D('1.00'), 'paid', None))
        payment = models.Payment.objects.get(paypal_transaction_id=paypal_mocks.CAPTURE_ID)
        self.assertEqual(payment.notes, 'Recorded by checking PayPal')

    def test_an_order_never_captured_is_cleared(self):
        invoice = registration_invoice(self.made.r1, 'PayPal', D('40.00'))
        invoice.pending_paypal_order_id = paypal_mocks.ORDER_ID
        invoice.save()
        self.reply(paypal_mocks.order(self.made.r1, invoice, D('41.00')))
        response = self.client.post(f'/api/invoices/{invoice.id}/check-paypal/')
        self.assertEqual(response.data['result'], 'not_captured')
        self.assertIsNone(self.invoice(invoice).pending_paypal_order_id)
        self.assertFalse(invoice.payments.exists())


class RefundThroughPayPalTests(PayPalTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.invoice = registration_invoice(cls.made.r1, 'PayPal', D('100.00'))
        cls.paid = models.Payment.objects.create(
            registration=cls.made.r1, invoice=cls.invoice, payment_type='PayPal',
            amount=D('102.50'), paypal_transaction_id=paypal_mocks.CAPTURE_ID)

    def refund(self, amount, request_id=None, status=201):
        response = self.client.post(f'/api/payments/{self.paid.id}/refund-paypal/', {
            'amount': amount, 'reason': 'Meal plan dropped',
            'request_id': request_id or uuid.uuid4().hex}, format='json')
        self.assertEqual(response.status_code, status, response.data)
        return response.data

    def test_a_partial_refund_is_recorded(self):
        self.reply(paypal_mocks.refund(value='30.00'), status=201)
        data = self.refund('30.00')
        self.assertEqual((data['amount'], data['refund_of'], data['invoice']),
                         ('-30.00', self.paid.id, self.invoice.id))
        request = self.paypal.requests[0]
        self.assertEqual(request['path_query'],
                         f'/v2/payments/captures/{paypal_mocks.CAPTURE_ID}/refund')
        self.assertEqual(request['json']['amount'], {'value': '30.00', 'currency_code': 'USD'})
        self.assertTrue(request['headers']['PayPal-Request-Id'].startswith('refund-'))

    def test_a_retried_request_records_one_refund(self):
        request_id = uuid.uuid4().hex
        reply = paypal_mocks.refund(value='30.00')
        self.reply(reply, reply, status=201)
        first = self.refund('30.00', request_id)
        second = self.refund('30.00', request_id)
        self.assertEqual(first['id'], second['id'])
        self.assertEqual(models.Payment.objects.filter(refund_of=self.paid).count(), 1)

    def test_a_retried_full_refund_gets_the_recorded_refund(self):
        # Nothing is left to refund after the first, so only the request id finds it.
        request_id = uuid.uuid4().hex
        self.reply(paypal_mocks.refund(value='102.50'), status=201)
        first = self.refund('102.50', request_id)
        second = self.refund('102.50', request_id)
        self.assertEqual(first['id'], second['id'])
        self.assertEqual(second['refund_request_id'], request_id)
        self.assertEqual(models.Payment.objects.filter(refund_of=self.paid).count(), 1)
        self.assertEqual(len(self.paypal.requests), 1)
        self.refund('102.50', status=409)  # a new request is still refused

    def test_a_retry_for_another_amount_is_refused(self):
        request_id = uuid.uuid4().hex
        self.reply(paypal_mocks.refund(value='30.00'), status=201)
        self.refund('30.00', request_id)
        data = self.refund('50.00', request_id, status=409)
        self.assertEqual(data['code'], 'refused')
        self.assertIn('already made, for $30.00', data['detail'])
        self.assertEqual(models.Payment.objects.filter(refund_of=self.paid).count(), 1)
        self.assertEqual(len(self.paypal.requests), 1)

    def test_a_refund_recorded_without_a_request_id_is_found_by_paypals_refund_id(self):
        # One recorded before refunds kept their request id: PayPal's reply to
        # the retry names the same refund, which is returned, not recorded again.
        recorded = models.Payment.objects.create(
            registration=self.made.r1, invoice=self.invoice, payment_type='PayPal',
            amount=D('-30.00'), refund_of=self.paid,
            paypal_transaction_id=paypal_mocks.refund()['id'])
        self.reply(paypal_mocks.refund(value='30.00'), status=201)
        data = self.refund('30.00')
        self.assertEqual(data['id'], recorded.id)
        self.assertEqual(models.Payment.objects.filter(refund_of=self.paid).count(), 1)
        self.assertEqual(len(self.paypal.requests), 1)

    def test_a_request_id_too_long_to_keep_is_refused_before_paypal(self):
        self.refund('10.00', 'x' * 65, status=400)
        self.assertEqual(self.paypal.requests, [])

    def test_not_more_than_is_left(self):
        data = self.refund('102.51', status=409)
        self.assertEqual(data['code'], 'refused')
        self.assertEqual(self.paypal.requests, [])

    def test_paypal_refusing(self):
        self.reply({'name': 'UNPROCESSABLE_ENTITY', 'message': 'Capture refund window expired',
                    'details': [{'issue': 'REFUND_TIME_LIMIT_EXCEEDED'}]}, status=422)
        data = self.refund('10.00', status=409)
        self.assertIn('Capture refund window expired', data['detail'])
        self.assertFalse(models.Payment.objects.filter(refund_of=self.paid).exists())

    def test_an_unknown_outcome_emails_the_event(self):
        self.reply({}, status=503)
        data = self.refund('10.00', status=502)
        self.assertEqual(data['code'], 'unknown')
        self.assertFalse(models.Payment.objects.filter(refund_of=self.paid).exists())
        [report] = [m for m in mail.outbox if 'needs checking' in m.subject]
        self.assertEqual(report.to, ['camp@example.com'])
        self.assertEqual(report.subject, f'PayPal refund needs checking — Registration '
                                         f'#{self.made.r1.id}, Invoice #{self.invoice.id}')
        self.assertIn('Refund requested: $10.00', report.body)
        self.assertIn(f'Capture id: {paypal_mocks.CAPTURE_ID}', report.body)
        # The same request again is safe: PayPal refunds it at most once.
        self.assertIn('again in this dialog', data['detail'])

    def test_what_paypal_refunded_is_recorded(self):
        # A retry, after the first reply was lost, that PayPal answers with the
        # earlier refund for its request id: the ledger follows the money, not
        # the request (#767). It keeps the request id, so a further retry for
        # the new amount is answered from the ledger and refused (#817).
        request_id = uuid.uuid4().hex
        self.reply(paypal_mocks.refund(value='25.00'), status=201)
        data = self.refund('30.00', request_id)
        self.assertEqual((data['amount'], data['refund_request_id']), ('-25.00', request_id))
        data = self.refund('30.00', request_id, status=409)
        self.assertIn('already made, for $25.00', data['detail'])
        self.assertEqual(self.refund('25.00', request_id)['amount'], '-25.00')
        self.assertEqual(models.Payment.objects.filter(refund_of=self.paid).count(), 1)
        self.assertEqual(len(self.paypal.requests), 1)

    def test_a_failure_recording_the_refund_emails_the_event(self):
        # PayPal gave the money back; the event must hear of it even though
        # recording it failed (#767).
        request_id = uuid.uuid4().hex
        self.reply(paypal_mocks.refund(value='10.00'), status=201)
        with mock.patch.object(models.Payment, 'save', side_effect=DatabaseError('disk full')), \
                self.assertLogs('camphoric.invoices', level='ERROR'):
            data = self.refund('10.00', request_id, status=502)
        self.assertEqual(data['code'], 'unknown')
        self.assertFalse(models.Payment.objects.filter(refund_of=self.paid).exists())
        report = models.EmailMessage.objects.get(kind='payment_report')
        self.assertIn('Refund requested: $10.00', report.text)
        self.assertIn('disk full', report.text)
        # Recorded by hand, it would have no request id, and the dialog's retry
        # would record it a second time: the advice is that retry, which PayPal
        # answers with the same refund, recorded once.
        self.assertIn('again in this dialog', data['detail'])
        self.assertNotIn('by hand', data['detail'])
        self.assertIn('press "Refund through PayPal" again', report.text)
        self.assertIn('Only if that dialog was closed', report.text)
        self.reply(paypal_mocks.refund(value='10.00'), status=201)
        self.assertEqual(self.refund('10.00', request_id)['amount'], '-10.00')
        self.assertEqual(models.Payment.objects.filter(refund_of=self.paid).count(), 1)

    def test_a_refund_for_more_than_is_left_isnt_recorded(self):
        # PayPal's reply, for a request id it saw before, is a refund for more
        # than is left of the payment (a refund was recorded by hand meanwhile):
        # recording it would give back more than was paid, so it's reported (#767).
        self.record(refund_of=self.paid.id, amount='-90.00')
        self.reply(paypal_mocks.refund(value='30.00'), status=201)
        with self.assertLogs('camphoric.invoices', level='ERROR'):
            data = self.refund('10.00', status=502)
        self.assertEqual(data['code'], 'unknown')
        self.assertEqual(models.Payment.objects.filter(refund_of=self.paid).count(), 1)
        report = models.EmailMessage.objects.get(kind='payment_report')
        self.assertIn('$30.00', report.text)
        self.assertIn('$12.50', report.text)
        # PayPal would answer a retry the same way: the advice is to look.
        self.assertIn('Don\'t try it again', data['detail'])
        self.assertIn('doesn\'t fit this payment', report.text)
        self.assertIn('Don\'t press "Refund through PayPal" again', report.text)
        self.assertNotIn('Ask whoever made the refund', report.text)

    def test_a_second_problem_with_one_request_is_emailed_too(self):
        # Recording failed and the event was told a retry records it; a refund
        # recorded by hand meanwhile leaves too little for PayPal's, so the
        # retry fails differently, and the event must hear of that as well.
        request_id = uuid.uuid4().hex
        self.reply(paypal_mocks.refund(value='10.00'), status=201)
        with mock.patch.object(models.Payment, 'save', side_effect=DatabaseError('disk full')), \
                self.assertLogs('camphoric.invoices', level='ERROR'):
            self.refund('10.00', request_id, status=502)
        self.record(refund_of=self.paid.id, amount='-95.00')
        self.reply(paypal_mocks.refund(value='10.00'), status=201)
        with self.assertLogs('camphoric.invoices', level='ERROR'):
            self.refund('5.00', request_id, status=502)
        first, second = models.EmailMessage.objects.filter(
            kind='payment_report').order_by('id')
        self.assertIn('disk full', first.text)
        self.assertIn('doesn\'t fit this payment', second.text)

    def test_a_refund_of_another_capture_isnt_recorded(self):
        self.reply(paypal_mocks.refund(value='10.00', capture_id='8MC585209K746392H'),
                   status=201)
        with self.assertLogs('camphoric.invoices', level='ERROR'):
            data = self.refund('10.00', status=502)
        self.assertEqual(data['code'], 'unknown')
        self.assertFalse(models.Payment.objects.filter(refund_of=self.paid).exists())
        report = models.EmailMessage.objects.get(kind='payment_report')
        self.assertIn('8MC585209K746392H', report.text)

    def test_registrars_may_refund(self):
        self.reply(paypal_mocks.refund(value='5.00'), status=201)
        self.refund('5.00')
        self.client.force_authenticate(self.reporter)
        self.refund('5.00', status=403)


class WhileARefundIsUnderwayTests(TransactionTestCase):
    '''
    A refund through PayPal holds its payment's row while it asks PayPal and
    records the answer. Anything else that checks what's left of the payment
    waits for it, so the two can't give back more than was paid between them
    (#767).
    '''

    def setUp(self):
        self.made = create_template_event()
        invoice = registration_invoice(self.made.r1, 'PayPal', D('100.00'))
        self.paid = models.Payment.objects.create(
            registration=self.made.r1, invoice=invoice, payment_type='PayPal',
            amount=D('100.00'), paypal_transaction_id=paypal_mocks.CAPTURE_ID)
        self.client = APIClient()
        self.client.force_authenticate(make_user(roles.ADMIN, 'boss'))

    def refund_by_hand(self, amount, status=201):
        response = self.client.post('/api/payments/', {
            'refund_of': self.paid.id, 'amount': amount, 'payment_type': 'Check',
            'attributes': {}}, format='json')
        self.assertEqual(response.status_code, status, response.data)
        return response

    def while_refunding(self, amount, request):
        '''
        Send `request` while a refund of `amount` through PayPal is underway.
        PayPal answers once `request` is done, or after a second if it's
        waiting (as it should be) for the refund to be recorded.
        '''
        asked, answered = threading.Event(), threading.Event()

        def refund_capture(*args, **kwargs):
            asked.set()
            answered.wait(1)
            return paypal_mocks.refund(value=f'{amount:.2f}')

        def refund():
            try:
                invoices.refund_paypal_payment(self.paid, amount, '', uuid.uuid4().hex)
            finally:
                connection.close()

        paypal = mock.Mock(refund_capture=mock.Mock(side_effect=refund_capture))
        with mock.patch.object(invoices, 'paypal_client', return_value=paypal):
            refunding = threading.Thread(target=refund)
            refunding.start()
            try:
                self.assertTrue(asked.wait(5))
                request()
            finally:
                answered.set()
                refunding.join(10)

    def refunded(self):
        return invoices.refunded(models.Payment.objects.get(pk=self.paid.pk))

    def test_a_refund_recorded_by_hand_waits(self):
        self.while_refunding(D('80.00'), lambda: self.refund_by_hand('-30.00', 400))
        self.assertEqual(self.refunded(), D('80.00'))

    def test_an_edit_of_a_refund_waits(self):
        refund_id = self.refund_by_hand('-10.00').data['id']

        def edit():
            response = self.client.patch(
                f'/api/payments/{refund_id}/', {'amount': '-30.00'}, format='json')
            self.assertEqual(response.status_code, 400, response.data)

        self.while_refunding(D('80.00'), edit)
        self.assertEqual(self.refunded(), D('90.00'))

    def test_restoring_a_refund_waits(self):
        refund_id = self.refund_by_hand('-30.00').data['id']
        self.assertEqual(self.client.delete(f'/api/payments/{refund_id}/').status_code, 204)

        def restore():
            response = self.client.post(f'/api/payments/{refund_id}/restore/')
            self.assertEqual(response.status_code, 409, response.data)

        self.while_refunding(D('80.00'), restore)
        self.assertEqual(self.refunded(), D('80.00'))

    def test_moving_the_payment_waits(self):
        other = models.Invoice.objects.create(
            registration=self.made.r1, origin='admin', amount=D('30'))

        def move():
            response = self.client.patch(
                f'/api/payments/{self.paid.id}/', {'invoice': other.id}, format='json')
            self.assertEqual(response.status_code, 400, response.data)

        self.while_refunding(D('80.00'), move)
        self.assertEqual(self.refunded(), D('80.00'))

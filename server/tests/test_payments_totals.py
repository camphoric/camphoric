'''
The Payments area's totals (SPEC §8.11; DR-173): what's owed and received,
the price line by line with each line's sign, custom charges and cancellation
fees by type, payments by type, and the handling fees beside PayPal's own.
'''

from decimal import Decimal

from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from camphoric import models, roles
from camphoric.payments_totals import total_signs
from tests.factories import create_template_event, make_user

D = Decimal


def paypal_order(capture_id, fee):
    '''A captured PayPal order, as stored with its payment, PayPal's fee in it.'''
    return {'id': 'ORDER-' + capture_id, 'purchase_units': [{'payments': {'captures': [{
        'id': capture_id, 'status': 'COMPLETED',
        'seller_receivable_breakdown': {'paypal_fee': {'currency_code': 'USD', 'value': fee}},
    }]}}]}


class PaymentsTotalsTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()
        cls.registrar = make_user(roles.REGISTRAR, 'reggie')
        cls.reporter = make_user(roles.REPORTER, 'rita')

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.registrar)
        self.today = timezone.localdate()

    def totals(self, status=200, event=None):
        event = event or self.made.event
        response = self.client.get(f'/api/events/{event.id}/payments-totals/')
        self.assertEqual(response.status_code, status, getattr(response, 'data', None))
        return response.data

    def pay(self, registration, amount, **fields):
        return models.Payment.objects.create(
            registration=registration, amount=D(amount), paid_on=self.today,
            payment_type=fields.pop('payment_type', 'Check'), **fields)

    def reprice(self, **logic):
        event = self.made.event
        for field, value in logic.items():
            setattr(event, field, value)
        event.save()
        for registration in (self.made.r1, self.made.r2):
            registration.refresh_from_db()
            registration.recalculate_server_pricing()

    # The template event: r1 is priced $825 (two campers' $400 tuition and a
    # $25 donation) and has paid $100 by check; r2 is priced $400 and has paid
    # $450.50 by PayPal, so it's owed $50.50 back.

    def test_whats_owed_and_received(self):
        totals = self.totals()
        self.assertEqual(totals['registrations'], 2)
        self.assertEqual(totals['summary'], {
            'price': '1225.00',
            'handling': '0.00',
            'owed': '1225.00',
            'received': '550.50',
            'balance': '674.50',
            'still_owed': '725.00',
            'refunds_due': '50.50',
            'not_invoiced': '0.00',
        })

    def test_the_price_line_by_line(self):
        self.assertEqual(self.totals()['charges'], {
            'lines': [
                {'var': 'donation', 'label': 'Campership donation', 'level': 'registration',
                 'credit': False, 'amount': '25.00'},
                {'var': 'tuition', 'label': 'Tuition', 'level': 'camper',
                 'credit': False, 'amount': '1200.00'},
            ],
            'other': '0.00',
            'total': '1225.00',
        })

    def test_a_line_the_total_subtracts_is_a_credit_and_a_count_isnt_money(self):
        self.reprice(camper_pricing_logic=[
            {'var': 'nights', 'label': 'Nights', 'exp': 3},
            {'var': 'tuition', 'label': 'Tuition', 'exp': {'var': 'pricing.adult'}},
            {'var': 'campership', 'label': 'Campership', 'exp': 50},
            {'var': 'total',
             'exp': {'+': [{'var': 'tuition'}, {'*': [{'var': 'campership'}, -1]}]}},
        ])
        charges = self.totals()['charges']
        self.assertEqual(
            [(line['var'], line['credit'], line['amount']) for line in charges['lines']],
            [('donation', False, '25.00'), ('tuition', False, '1200.00'),
             ('campership', True, '-150.00')])
        self.assertEqual((charges['other'], charges['total']), ('0.00', '1075.00'))

    def test_a_rate_times_a_count_is_other(self):
        self.reprice(camper_pricing_logic=[
            {'var': 'nights', 'label': 'Nights', 'exp': 5},
            {'var': 'rate', 'label': 'Nightly rate', 'exp': 60},
            {'var': 'total', 'exp': {'*': [{'var': 'nights'}, {'var': 'rate'}]}},
        ])
        charges = self.totals()['charges']
        self.assertEqual([line['var'] for line in charges['lines']], ['donation'])
        self.assertEqual((charges['other'], charges['total']), ('900.00', '925.00'))

    def test_a_line_of_both_logics_is_listed_once(self):
        # calculate_price sums a camper line into the registration line of its
        # name (and twice when the logic lists it twice): the camper line is
        # each camper's own, and the registration's $10 is other.
        self.reprice(
            registration_pricing_logic=[
                {'var': 'tuition', 'label': 'Deposit', 'exp': 10},
                {'var': 'total', 'exp': {'var': 'tuition'}},
            ],
            camper_pricing_logic=[
                {'var': 'tuition', 'label': 'Tuition', 'exp': {'var': 'pricing.adult'}},
                {'var': 'tuition', 'label': 'Tuition again', 'exp': {'var': 'pricing.adult'}},
                {'var': 'total', 'exp': {'var': 'tuition'}},
            ])
        charges = self.totals()['charges']
        self.assertEqual(
            [(line['var'], line['level'], line['amount']) for line in charges['lines']],
            [('tuition', 'camper', '1200.00')])
        self.assertEqual((charges['other'], charges['total']), ('20.00', '1220.00'))

    def test_what_no_line_accounts_for_is_other(self):
        # The total reads the donation from the registration's answers, not its line.
        self.reprice(registration_pricing_logic=[
            {'var': 'total', 'exp': {'var': ['registration.campership_donation', 0]}},
        ])
        charges = self.totals()['charges']
        self.assertEqual([line['var'] for line in charges['lines']], ['tuition'])
        self.assertEqual((charges['other'], charges['total']), ('25.00', '1225.00'))

    def test_registration_charges_and_cancellation_fees(self):
        fee = models.CustomChargeType.cancellation_fee(self.made.event)
        models.CustomCharge.objects.create(
            custom_charge_type=fee, registration=self.made.r2, amount=D('150.00'))
        models.CustomCharge.objects.create(
            custom_charge_type=fee, registration=self.made.r1, amount=D('40.00'))
        totals = self.totals()
        self.assertEqual(totals['charges']['lines'][-1], {
            'var': 'registration_charges', 'label': 'Registration charges', 'level': 'built_in',
            'credit': False, 'amount': '190.00'})
        self.assertEqual(totals['charges']['total'], '1415.00')
        self.assertEqual(totals['charge_types'], [
            {'type': 'linens', 'label': 'Linens', 'registration_own': False,
             'count': 1, 'amount': '25.00'},
            {'type': 'cancellation_fee', 'label': 'Cancellation fee', 'registration_own': True,
             'count': 2, 'amount': '190.00'},
        ])
        self.assertEqual(totals['cancellation_fees'], {'count': 2, 'amount': '190.00'})

    def test_no_promo_or_registration_charges_line_without_any(self):
        lines = [line['var'] for line in self.totals()['charges']['lines']]
        self.assertNotIn('promo', lines)
        self.assertNotIn('registration_charges', lines)

    def test_a_cancelled_campers_own_charges_go_with_them(self):
        self.made.c1.soft_delete()
        self.assertEqual(self.totals()['charge_types'], [])

    def test_payments_by_type(self):
        payment = self.made.i2.payments.order_by('-amount').first()
        self.pay(self.made.r2, '-50.50', payment_type='PayPal', invoice=self.made.i2,
                 refund_of=payment)
        self.assertEqual(self.totals()['payment_types'], [
            {'type': 'Check', 'label': 'Check', 'payments': 1, 'refunds': 0,
             'received': '100.00', 'refunded': '0.00', 'net': '100.00'},
            {'type': 'PayPal', 'label': 'PayPal', 'payments': 2, 'refunds': 1,
             'received': '450.50', 'refunded': '50.50', 'net': '400.00'},
        ])

    def test_an_events_own_payment_type_is_labelled_its_way(self):
        event = self.made.event
        event.payment_types = [{'value': 'Venmo', 'label': 'Venmo app'}]
        event.save()
        self.pay(self.made.r1, '25.00', payment_type='Venmo')
        [venmo] = [row for row in self.totals()['payment_types'] if row['type'] == 'Venmo']
        self.assertEqual((venmo['label'], venmo['net']), ('Venmo app', '25.00'))

    def test_handling_fees_beside_paypals_own(self):
        self.made.i2.handling = D('12.00')
        self.made.i2.save()
        for payment, (capture, fee) in zip(
                self.made.i2.payments.order_by('id'), (('CAP-1', '6.10'), ('CAP-2', '7.27'))):
            payment.paypal_response = paypal_order(capture, fee)
            payment.save()
        # PayPal keeps its fee on a refund, so a refund leaves it as it is.
        self.pay(self.made.r2, '-10.00', payment_type='PayPal', invoice=self.made.i2,
                 paypal_response={'id': 'REFUND-1', 'status': 'COMPLETED'})
        totals = self.totals()
        self.assertEqual(totals['online_fees'],
                         {'handling': '12.00', 'paypal_fees': '13.37', 'difference': '-1.37'})
        self.assertEqual((totals['summary']['handling'], totals['summary']['owed']),
                         ('12.00', '1237.00'))

    def test_a_cancelled_invoices_handling_isnt_charged(self):
        self.made.i2.handling = D('12.00')
        self.made.i2.cancelled_at = timezone.now()
        self.made.i2.save()
        self.assertEqual(self.totals()['online_fees']['handling'], '0.00')

    def test_not_invoiced(self):
        self.made.i1.amount = D('400.00')
        self.made.i1.save()
        self.assertEqual(self.totals()['summary']['not_invoiced'], '425.00')

    def test_deleted_registrations_and_other_events_dont_count(self):
        self.made.r2.soft_delete()
        totals = self.totals()
        self.assertEqual(totals['registrations'], 1)
        self.assertEqual((totals['summary']['price'], totals['summary']['received']),
                         ('825.00', '100.00'))
        self.assertEqual([row['type'] for row in totals['payment_types']], ['Check'])
        other = models.Event.objects.create(organization=self.made.organization, name='Other')
        self.assertEqual(self.totals(event=other)['summary']['price'], '0.00')

    def test_reporters_read_it(self):
        self.client.force_authenticate(self.reporter)
        self.assertEqual(self.totals()['summary']['price'], '1225.00')

    def test_signed_out_is_refused(self):
        self.client.force_authenticate(None)
        self.totals(status=401)


class TotalSignsTests(SimpleTestCase):
    def test_a_sum(self):
        self.assertEqual(total_signs({'+': [{'var': 'a'}, {'var': ['b', 0]}]}), {'a': 1, 'b': 1})

    def test_subtracting(self):
        self.assertEqual(total_signs({'-': [{'var': 'a'}, {'var': 'b'}, {'var': 'c'}]}),
                         {'a': 1, 'b': -1, 'c': -1})
        self.assertEqual(total_signs({'-': [{'var': 'a'}]}), {'a': -1})

    def test_times_minus_one(self):
        self.assertEqual(total_signs({'*': [{'var': 'a'}, -1]}), {'a': -1})
        self.assertEqual(total_signs({'*': [-1, {'-': [{'var': 'a'}]}]}), {'a': 1})

    def test_not_an_amount_the_total_doesnt_add_as_it_is(self):
        # A count times a rate, a half, a quotient, a cap: none is a line of the total.
        self.assertEqual(total_signs({'*': [{'var': 'nights'}, {'var': 'rate'}]}), {})
        self.assertEqual(total_signs({'*': [{'var': 'a'}, 0.5]}), {})
        self.assertEqual(total_signs({'/': [{'var': 'a'}, 2]}), {})
        self.assertEqual(total_signs({'min': [{'var': 'subtotal'}, {'var': 'cap'}]}), {})
        self.assertEqual(total_signs({'+': [{'var': 'a'}, {'max': [{'var': 'b'}, 0]}]}),
                         {'a': 1})

    def test_an_ifs_branches_not_its_condition(self):
        exp = {'if': [{'>': [{'var': 'age'}, 12]}, {'var': 'adult'}, {'var': 'child'}]}
        self.assertEqual(total_signs(exp), {'adult': 1, 'child': 1})

    def test_a_comparison_or_unknown_operator_adds_nothing(self):
        self.assertEqual(total_signs({'reduce': [{'var': 'items'}, {'var': 'current'}, 0]}), {})
        self.assertEqual(total_signs(25), {})

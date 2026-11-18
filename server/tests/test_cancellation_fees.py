'''
Registration-level custom charges and cancellation fees (SPEC §8.5, §9.2, §9.7;
DR-170): a registration's own charges are added to its total, and cancelling a
camper can keep a fee that stays when they go.
'''

import datetime
from decimal import Decimal

from rest_framework.test import APITestCase

from camphoric import invoices, models, pricing, roles
from tests.factories import create_template_event, make_user

D = Decimal


class CancellationTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        # r1: Pat ($400, and $25 of linens the pricing doesn't count) and Sam
        # ($400), a $25 donation: $825, $100 paid on its $825 invoice.
        cls.made = create_template_event()
        cls.registrar = make_user(roles.REGISTRAR, 'reggie')
        cls.reporter = make_user(roles.REPORTER, 'rita')

    def setUp(self):
        self.client.force_authenticate(self.registrar)

    def registration(self):
        return models.Registration.all_objects.get(pk=self.made.r1.pk)

    def total(self):
        return self.registration().server_pricing_results['total']

    def cancel(self, camper, fee=None, status=200, **headers):
        response = self.client.post(
            f'/api/campers/{camper.id}/cancel/', {'cancellation_fee': fee}, format='json',
            headers=headers)
        self.assertEqual(response.status_code, status, response.data)
        return response.data

    def fees(self):
        return models.CustomCharge.objects.filter(
            registration=self.made.r1, camper__isnull=True)


class CancellingTests(CancellationTestCase):
    def test_without_a_fee_it_is_a_delete(self):
        data = self.cancel(self.made.c2)
        self.assertIsNone(data['cancellation_fee'])
        self.assertIsNotNone(models.Camper.all_objects.get(pk=self.made.c2.pk).deleted_at)
        self.assertFalse(self.fees().exists())
        self.assertEqual(self.total(), 425)
        self.assertNotIn(pricing.REGISTRATION_CHARGES, self.registration().server_pricing_results)

    def test_with_a_fee_the_fee_stays_on_the_registration(self):
        data = self.cancel(self.made.c2, {'amount': '50.00', 'notes': 'Cancellation: Sam Alpha'})
        fee = models.CustomCharge.objects.get(pk=data['cancellation_fee']['id'])
        self.assertEqual((fee.registration_id, fee.camper_id, fee.cancelled_camper_id),
                         (self.made.r1.id, None, self.made.c2.id))
        self.assertEqual((fee.amount, fee.notes), (D('50.00'), 'Cancellation: Sam Alpha'))
        self.assertEqual(
            (fee.custom_charge_type.name, fee.custom_charge_type.label),
            ('cancellation_fee', 'Cancellation fee'))
        results = self.registration().server_pricing_results
        self.assertEqual(results[pricing.REGISTRATION_CHARGES], 50)
        self.assertEqual(results['total'], 475)
        # Its campers' breakdowns are only Pat's.
        self.assertEqual(len(results['campers']), 1)

    def test_a_second_fee_uses_the_same_charge_type(self):
        self.cancel(self.made.c2, {'amount': '50'})
        self.cancel(self.made.c1, {'amount': '30'})
        self.assertEqual(models.CustomChargeType.objects.filter(
            event=self.made.event, name='cancellation_fee').count(), 1)
        # Every camper gone: the donation and the two fees.
        self.assertEqual(self.total(), 105)

    def test_pats_own_charges_go_with_him_and_the_fee_stays(self):
        self.cancel(self.made.c1, {'amount': '40'})
        self.assertFalse(models.CustomCharge.objects.filter(camper=self.made.c1).exists())
        self.assertEqual([fee.amount for fee in self.fees()], [D('40.00')])

    def test_the_fee_is_in_the_registrations_history_and_the_campers(self):
        fee_id = self.cancel(self.made.c2, {'amount': '50'})['cancellation_fee']['id']
        for path in (f'/api/registrations/{self.made.r1.id}/history/',
                     f'/api/campers/{self.made.c2.id}/history/'):
            entries = self.client.get(path).data
            created = [e for e in entries if e['object']['type'] == 'customcharge'
                       and str(e['object']['id']) == str(fee_id)]
            self.assertEqual(len(created), 1, path)
            self.assertEqual(created[0]['action'], 'create')
            self.assertEqual(created[0]['actor']['username'], 'reggie')

    def test_a_cancel_and_refund_ends_at_nothing_due(self):
        r1, invoice = self.made.r1, self.made.i1
        paid = self.client.post('/api/payments/', {
            'registration': r1.id, 'invoice': invoice.id, 'payment_type': 'Check',
            'amount': '725.00', 'attributes': {}}, format='json')
        self.assertEqual(paid.status_code, 201, paid.data)
        self.assertEqual(invoices.ledger(self.registration()).balance, D('0.00'))

        self.cancel(self.made.c2, {'amount': '50'})
        # $475 owed of the $825 paid: the registrar lowers the invoice to the
        # new price, then refunds the difference.
        self.assertEqual(invoices.ledger(self.registration()).balance, D('-350.00'))
        response = self.client.patch(
            f'/api/invoices/{invoice.id}/', {'amount': '475.00'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        refund = self.client.post('/api/payments/', {
            'registration': r1.id, 'refund_of': paid.data['id'], 'payment_type': 'Check',
            'amount': '-350.00', 'attributes': {}}, format='json')
        self.assertEqual(refund.status_code, 201, refund.data)

        ledger = invoices.ledger(self.registration())
        self.assertEqual((ledger.price, ledger.total_paid, ledger.balance),
                         (D('475.00'), D('475.00'), D('0.00')))
        self.assertEqual(models.Invoice.objects.get(pk=invoice.pk).status, 'paid')
        rows = self.client.get('/api/registrations/', {'event': self.made.event.id}).data
        self.assertEqual(next(row for row in rows if row['id'] == r1.id)['balance'], 0.0)

    def test_restoring_keeps_the_fee_until_it_is_removed(self):
        fee_id = self.cancel(self.made.c2, {'amount': '50'})['cancellation_fee']['id']
        response = self.client.post(f'/api/campers/{self.made.c2.id}/restore/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.total(), 875)

        # The client finds the fee kept for them, to offer to remove it.
        listed = self.client.get('/api/customcharges/', {'cancelled_camper': self.made.c2.id})
        self.assertEqual([row['id'] for row in listed.data], [fee_id])
        response = self.client.delete(f'/api/customcharges/{fee_id}/')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.total(), 825)
        self.assertNotIn(pricing.REGISTRATION_CHARGES, self.registration().server_pricing_results)

    def test_a_fee_must_be_more_than_nothing(self):
        for fee in ({'amount': '0'}, {'amount': '-5'}, {'notes': 'No amount'}, {'amount': 'x'}):
            self.cancel(self.made.c2, fee, status=400)
        self.assertIsNone(models.Camper.all_objects.get(pk=self.made.c2.pk).deleted_at)
        self.assertFalse(self.fees().exists())

    def test_a_stale_version_cancels_nothing(self):
        self.cancel(self.made.c2, {'amount': '50'}, status=412, if_match='"999"')
        self.assertIsNone(models.Camper.all_objects.get(pk=self.made.c2.pk).deleted_at)
        self.assertFalse(self.fees().exists())
        version = models.Camper.objects.get(pk=self.made.c2.pk).version
        self.cancel(self.made.c2, {'amount': '50'}, if_match=f'"{version}"')

    def test_a_reporter_cant_cancel(self):
        self.client.force_authenticate(self.reporter)
        self.cancel(self.made.c2, {'amount': '50'}, status=403)
        self.assertIsNone(models.Camper.all_objects.get(pk=self.made.c2.pk).deleted_at)

    def test_a_body_that_isnt_an_object_is_refused(self):
        for body in ([], 'x'):
            response = self.client.post(
                f'/api/campers/{self.made.c2.id}/cancel/', body, format='json')
            self.assertEqual(response.status_code, 400, response.data)
        self.assertIsNone(models.Camper.all_objects.get(pk=self.made.c2.pk).deleted_at)

    def test_with_every_camper_gone_and_no_registration_total_the_fees_are_the_total(self):
        event = self.made.event
        event.registration_pricing_logic = [
            line for line in event.registration_pricing_logic if line['var'] != 'total']
        event.save()
        self.cancel(self.made.c1, {'amount': '30'})
        self.cancel(self.made.c2, {'amount': '50'})
        results = self.registration().server_pricing_results
        self.assertEqual((results[pricing.REGISTRATION_CHARGES], results['total']), (80, 80))

    def test_a_deleted_camper_cant_be_cancelled(self):
        self.cancel(self.made.c2)
        self.cancel(self.made.c2, {'amount': '50'}, status=404)


class RegistrationChargeTests(CancellationTestCase):
    def charge(self, status=201, **data):
        response = self.client.post('/api/customcharges/', {
            'custom_charge_type': self.made.linens.id, 'amount': '10.00', **data}, format='json')
        self.assertEqual(response.status_code, status, response.data)
        return response.data

    def test_one_without_a_camper_is_the_registrations_own(self):
        data = self.charge(registration=self.made.r1.id)
        self.assertIsNone(data['camper'])
        self.assertEqual(self.total(), 835)
        self.assertEqual(
            self.registration().server_pricing_results[pricing.REGISTRATION_CHARGES], 10)

    def test_a_campers_registration_is_the_campers(self):
        data = self.charge(camper=self.made.c3.id)
        self.assertEqual(data['registration'], self.made.r2.id)
        self.charge(400, camper=self.made.c3.id, registration=self.made.r1.id)

    def test_it_needs_a_camper_or_a_registration(self):
        self.charge(400)

    def test_its_type_is_the_registrations_events(self):
        other = models.Event.objects.create(organization=self.made.organization, name='Other')
        foreign = models.CustomChargeType.objects.create(event=other, name='x', label='X')
        self.charge(400, registration=self.made.r1.id, custom_charge_type=foreign.id)

    def test_it_cant_move_to_another_registration(self):
        data = self.charge(registration=self.made.r1.id)
        response = self.client.patch(
            f'/api/customcharges/{data["id"]}/', {'registration': self.made.r2.id},
            format='json')
        self.assertEqual(response.status_code, 400, response.data)

    def test_cancelled_camper_is_set_only_by_cancelling(self):
        data = self.charge(registration=self.made.r1.id, cancelled_camper=self.made.c2.id)
        self.assertIsNone(data['cancelled_camper'])

    def test_filtered_by_registration(self):
        own = self.charge(registration=self.made.r1.id)
        listed = self.client.get('/api/customcharges/', {'registration': self.made.r1.id})
        pats = models.CustomCharge.objects.get(camper=self.made.c1)
        self.assertEqual({row['id'] for row in listed.data}, {own['id'], pats.id})

    def test_deleting_the_registration_hides_them_and_restoring_brings_them_back(self):
        own = self.charge(registration=self.made.r1.id)
        preview = self.client.get(f'/api/registrations/{self.made.r1.id}/delete-preview/').data
        hidden = {entry['type']: entry['count'] for entry in preview['deletes']}
        self.assertEqual(hidden['customcharge'], 2)
        self.assertEqual(self.client.delete(f'/api/registrations/{self.made.r1.id}/').status_code,
                         204)
        self.assertFalse(models.CustomCharge.objects.filter(pk=own['id']).exists())
        self.client.post(f'/api/registrations/{self.made.r1.id}/restore/')
        self.assertTrue(models.CustomCharge.objects.filter(pk=own['id']).exists())

    def test_a_camper_delete_preview_doesnt_list_a_fee_kept_for_them(self):
        self.charge(registration=self.made.r1.id)
        preview = self.client.get(f'/api/campers/{self.made.c1.id}/delete-preview/').data
        hidden = {entry['type']: entry['count'] for entry in preview['deletes']}
        self.assertEqual(hidden, {'customcharge': 1})  # Pat's linens


class PricingTests(CancellationTestCase):
    def add(self, amount):
        return models.CustomCharge.objects.create(
            registration=self.registration(), custom_charge_type=self.made.linens,
            amount=D(amount))

    def test_logic_sees_the_registrations_charges(self):
        event = self.made.event
        event.registration_pricing_logic = [
            {'var': 'charge_count', 'exp': {'reduce': [
                {'var': 'registration.custom_charges'},
                {'+': [{'var': 'accumulator'}, 1]}, 0]}},
            *event.registration_pricing_logic,
        ]
        event.save()
        self.add('10')
        self.add('5')
        results = self.registration().server_pricing_results
        self.assertEqual(results['charge_count'], 2)
        self.assertEqual(results[pricing.REGISTRATION_CHARGES], 15)
        self.assertEqual(results['total'], 840)

    def test_the_promo_code_doesnt_discount_them(self):
        promo = models.PromoCode.objects.create(
            event=self.made.event, code='HALF', label='Half off',
            pricing_logic={'*': [{'var': 'total'}, 0.5]})
        registration = self.registration()
        registration.promo_code = promo
        registration.save()
        self.add('50')
        results = self.registration().server_pricing_results
        self.assertEqual((results['promo'], results['total']), (-412.5, 462.5))

    def test_a_credit_doesnt_take_the_total_below_nothing(self):
        self.add('-1000')
        results = self.registration().server_pricing_results
        self.assertEqual((results[pricing.REGISTRATION_CHARGES], results['total']), (-1000, 0))

    def test_without_any_the_price_is_as_it_was(self):
        before = pricing.calculate_price(self.made.r1, list(self.made.r1.campers.all()))
        self.assertNotIn(pricing.REGISTRATION_CHARGES, before)
        self.assertEqual(before['total'], 825)

    def test_the_line_is_labelled(self):
        self.assertEqual(pricing.line_label(self.made.event, pricing.REGISTRATION_CHARGES),
                         'Registration charges')


class TemplateTests(CancellationTestCase):
    def test_reports_read_the_registrations_own_charges(self):
        self.client.post(f'/api/campers/{self.made.c2.id}/cancel/',
                         {'cancellation_fee': {'amount': '50', 'notes': 'Sam'}}, format='json')
        report = models.Report.objects.create(
            event=self.made.event, title='Fees', output='txt', variables_source='server',
            template=(
                '{% for r in registrations %}{% for c in r.custom_charges %}'
                '{{ c.name }} {{ c.amount }} {{ c.notes }} {{ c.camper is none }} '
                '{{ c.registration.registrant_email }}{% endfor %}{% endfor %}'))
        response = self.client.post(f'/api/reports/{report.id}/render', {}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['report'].strip(),
                         'cancellation_fee 50.00 Sam True pat@example.com')


TIERED = {'if': [
    {'>=': [{'var': 'days_before_start'}, 30]}, {'*': [{'var': 'total'}, 0.1]},
    {'*': [{'var': 'total'}, 0.5]},
]}


class EventSettingTests(CancellationTestCase):
    '''The event's cancellation fee: JsonLogic, or none (DR-170).'''

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.admin = make_user(roles.ADMIN, 'boss')

    def patch(self, fee, status=200):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f'/api/events/{self.made.event.id}/', {'cancellation_fee': fee}, format='json')
        self.assertEqual(response.status_code, status, response.data)
        return response.data

    def test_none_by_default(self):
        response = self.client.get(f'/api/events/{self.made.event.id}/')
        self.assertIsNone(response.data['cancellation_fee'])

    def test_jsonlogic_or_a_number(self):
        for fee in (TIERED, {'*': [{'var': 'total'}, 0.1]}, 50, 12.5):
            self.assertEqual(self.patch(fee)['cancellation_fee'], fee)
        self.assertIsNone(self.patch(None)['cancellation_fee'])

    def test_what_isnt_jsonlogic_is_refused(self):
        for fee in ('ten', True, [1, 2], {}, {'*': [1, 2], 'min': [1, 2]}):
            self.assertIn('cancellation_fee', self.patch(fee, status=400), fee)
        self.assertIsNone(models.Event.objects.get(pk=self.made.event.pk).cancellation_fee)


class WorkingOutTheFeeTests(CancellationTestCase):
    '''What the event's logic offers for a camper (DR-170).'''

    def set_fee(self, logic):
        event = models.Event.objects.get(pk=self.made.event.pk)
        event.cancellation_fee = logic
        event.save()

    def fee(self, camper=None, at=None):
        camper = models.Camper.objects.get(pk=(camper or self.made.c2).pk)
        return pricing.cancellation_fee(camper, at)

    def at(self, day):
        return datetime.datetime(2026, *day, 12, tzinfo=datetime.timezone.utc)

    def test_none_without_logic(self):
        self.assertIsNone(self.fee())

    def test_a_percent_of_the_campers_total(self):
        self.set_fee({'*': [{'var': 'total'}, 0.1]})
        self.assertEqual(self.fee(), D('40.00'))

    def test_tiers_by_how_long_before_camp(self):
        # Camp starts 2026-12-30.
        self.set_fee(TIERED)
        self.assertEqual(self.fee(at=self.at((11, 30))), D('40.00'))   # 30 days before
        self.assertEqual(self.fee(at=self.at((12, 1))), D('200.00'))   # 29 days before

    def test_it_sees_the_camper_and_the_registration(self):
        self.set_fee({'if': [
            {'and': [{'==': [{'var': 'camper.first_name'}, 'Sam']},
                     {'==': [{'var': 'registration.comments'}, 'Hi']}]}, 25, 5]})
        self.assertEqual(self.fee(), D('25.00'))
        self.assertEqual(self.fee(self.made.c1), D('5.00'))

    def test_to_the_cent_and_never_below_nothing(self):
        self.set_fee({'*': [{'var': 'total'}, 0.0333]})
        self.assertEqual(self.fee(), D('13.32'))
        self.set_fee(-5)
        self.assertEqual(self.fee(), D('0.00'))
        self.set_fee({'var': 'no_such_line'})
        self.assertEqual(self.fee(), D('0.00'))

    def test_the_api_offers_it(self):
        self.set_fee({'*': [{'var': 'total'}, 0.1]})
        response = self.client.get(f'/api/campers/{self.made.c2.id}/cancellation-fee/')
        self.assertEqual(response.data, {'amount': '40.00'})

    def test_the_api_says_when_theres_none(self):
        response = self.client.get(f'/api/campers/{self.made.c2.id}/cancellation-fee/')
        self.assertEqual(response.data, {'amount': None})

    def test_the_api_says_when_it_cant_be_worked_out(self):
        self.set_fee({'no_such_operation': [1]})
        response = self.client.get(f'/api/campers/{self.made.c2.id}/cancellation-fee/')
        self.assertIsNone(response.data['amount'])
        self.assertIn('couldn\'t be worked out', response.data['error'])

    def test_a_decimal_result_is_worked_out(self):
        event = models.Event.objects.get(pk=self.made.event.pk)
        event.epayment_handling = D('2.5')
        event.save()
        self.set_fee({'var': 'event.epayment_handling'})
        self.assertEqual(self.fee(), D('2.50'))

    def test_what_cant_be_money_says_so_rather_than_failing(self):
        self.set_fee(1e30)
        response = self.client.get(f'/api/campers/{self.made.c2.id}/cancellation-fee/')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['amount'])
        self.assertIn('couldn\'t be worked out', response.data['error'])

    def test_a_camper_schema_without_properties_says_so_rather_than_failing(self):
        event = models.Event.objects.get(pk=self.made.event.pk)
        event.camper_schema = {'type': 'object'}
        event.cancellation_fee = 5
        event.save()
        with self.assertRaises(ValueError):
            self.fee()

    def paid_by_paypal(self, fee, amount='725.00'):
        order = {'purchase_units': [{'payments': {'captures': [{
            'id': f'CAP{amount}', 'status': 'COMPLETED',
            'amount': {'currency_code': 'USD', 'value': amount},
            'seller_receivable_breakdown': {
                'gross_amount': {'currency_code': 'USD', 'value': amount},
                'paypal_fee': {'currency_code': 'USD', 'value': fee},
            },
        }]}}]}
        return models.Payment.objects.create(
            registration=self.made.r1, invoice=self.made.i1, amount=D(amount),
            payment_type='PayPal', paypal_response=order, paypal_transaction_id=f'CAP{amount}')

    def test_paypals_fees_on_the_registration(self):
        self.paid_by_paypal('24.25')
        self.paid_by_paypal('1.10', amount='10.00')
        self.set_fee({'var': 'paypal_fees'})
        self.assertEqual(self.fee(), D('25.35'))

    def test_no_paypal_fees_without_paypal_payments(self):
        self.set_fee({'var': 'paypal_fees'})
        self.assertEqual(self.fee(), D('0.00'))

    def test_a_flat_fee_and_paypals_fees_once_per_registration(self):
        # Lark Camp's policy: $150 for each camper, and PayPal's fees once.
        self.paid_by_paypal('24.25')
        self.set_fee({'+': [150, {'if': [
            {'var': 'first_cancellation'}, {'var': 'paypal_fees'}, 0]}]})
        response = self.client.get(f'/api/campers/{self.made.c2.id}/cancellation-fee/')
        self.assertEqual(response.data, {'amount': '174.25'})
        self.cancel(self.made.c2, {'amount': response.data['amount']})
        response = self.client.get(f'/api/campers/{self.made.c1.id}/cancellation-fee/')
        self.assertEqual(response.data, {'amount': '150.00'})

    def test_a_reporter_isnt_offered_one(self):
        self.client.force_authenticate(self.reporter)
        response = self.client.get(f'/api/campers/{self.made.c2.id}/cancellation-fee/')
        self.assertEqual(response.status_code, 403)

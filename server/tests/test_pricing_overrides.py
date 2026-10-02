'''
A registrar's amount for one price line (models.PricingOverride, SPEC DR-56):
applied right after that line, so the totals follow; never the total; hidden
from registrants' templates. The handling fee isn't a price line any more: it's
on invoices (SPEC DR-88).
'''

from decimal import Decimal

from rest_framework.test import APITestCase

from camphoric import models, roles
from camphoric.templating.graph import build_event_graph
from tests.factories import create_template_event, make_user

# The factory's pricing: a registration's `donation` (Pat gave $25) and `total`,
# and each camper's `tuition` ($400) and `total`.


class OverrideTestCase(APITestCase):
    def setUp(self):
        self.made = create_template_event()
        self.registrar = make_user(roles.REGISTRAR, 'reggie')
        self.client.force_authenticate(self.registrar)

    def override(self, status=201, **fields):
        data = {'reason': 'Instructor’s kid', **fields}
        response = self.client.post('/api/pricingoverrides/', data, format='json')
        self.assertEqual(response.status_code, status, response.data)
        return response.data

    def prices(self, row):
        row.refresh_from_db()
        return row.server_pricing_results


class CamperLineTests(OverrideTestCase):
    def test_the_line_changes_and_the_totals_follow(self):
        made = self.made
        self.assertEqual(self.prices(made.r1)['total'], 825)

        data = self.override(camper=made.c1.id, var='tuition', amount='250.00')
        self.assertEqual(data['registration'], made.r1.id)
        self.assertEqual(data['created_by_name'], 'reggie')
        self.assertTrue(data['applied'])

        camper = self.prices(made.c1)
        self.assertEqual((camper['tuition'], camper['total']), (250, 250))
        self.assertEqual(camper['overridden'], {'tuition': 400})
        registration = self.prices(made.r1)
        self.assertEqual((registration['tuition'], registration['total']), (650, 675))
        # Only Pat's line changed.
        self.assertNotIn('overridden', self.prices(made.c2))

    def test_removing_it_brings_the_computed_price_back(self):
        data = self.override(camper=self.made.c1.id, var='tuition', amount='0')
        self.assertEqual(self.prices(self.made.r1)['total'], 425)
        response = self.client.delete(f'/api/pricingoverrides/{data["id"]}/')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.prices(self.made.r1)['total'], 825)
        self.assertNotIn('overridden', self.prices(self.made.c1))

    def test_it_comes_back_with_a_restored_camper(self):
        made = self.made
        self.override(camper=made.c2.id, var='tuition', amount='100')
        self.client.delete(f'/api/campers/{made.c2.id}/')
        self.assertEqual(self.prices(made.r1)['total'], 425)
        self.client.post(f'/api/campers/{made.c2.id}/restore/')
        self.assertEqual(self.prices(made.r1)['total'], 525)


class RegistrationLineTests(OverrideTestCase):
    def test_it_stays_through_later_edits(self):
        made = self.made
        self.override(registration=made.r1.id, var='donation', amount='0')
        self.assertEqual(self.prices(made.r1)['total'], 800)

        response = self.client.patch(
            f'/api/registrations/{made.r1.id}/',
            {'attributes': {**made.r1.attributes, 'campership_donation': 50}}, format='json')
        self.assertEqual(response.status_code, 200)
        results = self.prices(made.r1)
        self.assertEqual((results['donation'], results['total']), (0, 800))
        self.assertEqual(results['overridden'], {'donation': 50})

    def test_the_handling_fee_is_not_a_line(self):
        made = self.made
        made.event.epayment_handling = Decimal('10')
        made.event.save()
        made.r1.save()
        self.assertNotIn('handling', self.prices(made.r1))
        self.override(status=400, registration=made.r1.id, var='handling', amount='0')


class RulesTests(OverrideTestCase):
    def test_not_the_total_nor_a_line_that_isnt_there(self):
        made = self.made
        self.override(status=400, camper=made.c1.id, var='total', amount='0')
        self.override(status=400, registration=made.r1.id, var='total', amount='0')
        self.override(status=400, camper=made.c1.id, var='meals', amount='0')
        # A camper line isn't a registration line.
        self.override(status=400, registration=made.r1.id, var='tuition', amount='0')

    def test_a_reason_is_needed(self):
        self.override(status=400, camper=self.made.c1.id, var='tuition', amount='0', reason=' ')

    def test_one_override_per_line(self):
        self.override(camper=self.made.c1.id, var='tuition', amount='0')
        self.override(status=400, camper=self.made.c1.id, var='tuition', amount='5')

    def test_a_line_the_pricing_no_longer_has_is_skipped(self):
        made = self.made
        data = self.override(camper=made.c1.id, var='tuition', amount='0')
        made.event.camper_pricing_logic = [
            {'var': 'fee', 'label': 'Fee', 'exp': 100},
            {'var': 'total', 'exp': {'var': 'fee'}},
        ]
        made.event.save()
        made.r1.save()
        self.assertEqual(self.prices(made.c1)['total'], 100)
        self.assertNotIn('overridden', self.prices(made.c1))
        self.assertFalse(self.client.get(f'/api/pricingoverrides/{data["id"]}/').data['applied'])

    def test_reporters_can_look_but_not_change(self):
        data = self.override(camper=self.made.c1.id, var='tuition', amount='0')
        self.client.force_authenticate(make_user(roles.REPORTER, 'rita'))
        listed = self.client.get('/api/pricingoverrides/', {'registration': self.made.r1.id})
        self.assertEqual([row['id'] for row in listed.data], [data['id']])
        self.override(status=403, camper=self.made.c2.id, var='tuition', amount='0')


class WhereItShowsTests(OverrideTestCase):
    def test_templates_see_only_the_new_amount(self):
        self.override(camper=self.made.c1.id, var='tuition', amount='250')
        graph = build_event_graph(self.made.event)
        camper = graph.get('camper', self.made.c1.id)
        self.assertEqual(camper['pricing']['tuition'], 250)
        self.assertNotIn('overridden', camper['pricing'])
        registration = graph.get('registration', self.made.r1.id)
        self.assertEqual(registration['total_owed'], 675)
        self.assertNotIn('overridden', registration['pricing'])

    def test_it_is_in_the_history(self):
        self.override(camper=self.made.c1.id, var='tuition', amount='250')
        for path in (f'/api/registrations/{self.made.r1.id}/history/',
                     f'/api/campers/{self.made.c1.id}/history/'):
            with self.subTest(path=path):
                entries = self.client.get(path).data
                created = next(e for e in entries if e['object']['type'] == 'pricingoverride')
                self.assertEqual(created['object']['label'], 'Tuition for Pat Alpha: $250.00')
                self.assertEqual(created['actor']['username'], 'reggie')

    def test_the_label_names_a_registration_line(self):
        override = models.PricingOverride.objects.create(
            registration=self.made.r1, var='donation', amount=Decimal('0'), reason='Waived')
        self.assertEqual(str(override), 'Campership donation: $0.00')

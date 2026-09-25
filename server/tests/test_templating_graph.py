import datetime
from decimal import Decimal

from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext

from camphoric import models
from camphoric.templating.graph import build_event_graph
from camphoric.templating.values import ReadOnlyDict, ReadOnlyList

from tests.factories import create_template_event


class EventGraphTests(TestCase):
    def setUp(self):
        self.made = create_template_event()
        self.graph = build_event_graph(self.made.event)

    def camper(self, row):
        return self.graph.get('camper', row.id)

    def test_resolves_relationships(self):
        pat = self.camper(self.made.c1)
        registration = pat['registration']
        self.assertEqual(registration['registrant_email'], 'pat@example.com')
        self.assertIs(registration['campers'][0], pat)
        self.assertEqual([c['attributes']['first_name'] for c in registration['campers']],
                         ['Pat', 'Sam'])
        self.assertEqual(pat['index'], 0)
        self.assertEqual(self.camper(self.made.c2)['index'], 1)
        self.assertEqual(pat['custom_charges'][0]['label'], 'Linens')
        self.assertIs(pat['custom_charges'][0]['camper'], pat)

    def test_lodging_tree_and_paths(self):
        cabin_a = self.graph.get('lodging', self.made.cabin_a.id)
        self.assertEqual(cabin_a['full_name'], 'Cabins→Cabin A')
        self.assertEqual(list(cabin_a['path_names']), ['Cabins', 'Cabin A'])
        self.assertEqual([n['name'] for n in cabin_a['ancestors']], ['Camp', 'Cabins'])
        self.assertEqual(cabin_a['depth'], 2)
        self.assertTrue(cabin_a['is_leaf'])
        root = self.graph.lodging_root
        self.assertTrue(root['is_root'])
        self.assertEqual(root['full_name'], '')
        self.assertIs(self.camper(self.made.c1)['lodging'], cabin_a)
        # Only campers of completed registrations are counted.
        cabins = self.graph.get('lodging', self.made.cabins.id)
        self.assertEqual({c['id'] for c in cabins['all_campers']},
                         {self.made.c1.id, self.made.c2.id})
        self.assertEqual(root['camper_count'], 3)
        self.assertEqual([n['name'] for n in self.graph.lodgings],
                         ['Camp', 'Cabins', 'Cabin A', 'Cabin B', 'Tents', 'Tent 1'])

    def test_collections_are_completed_only(self):
        self.assertEqual([r['id'] for r in self.graph.registrations],
                         [self.made.r1.id, self.made.r2.id])
        self.assertEqual([r['id'] for r in self.graph.incomplete_registrations],
                         [self.made.r3.id])
        self.assertNotIn(self.made.c4.id, [c['id'] for c in self.graph.campers])
        self.assertEqual(len(self.graph.payments), 3)

    def test_money_and_pricing(self):
        lee = self.graph.get('registration', self.made.r2.id)
        self.assertEqual(lee['total_paid'], Decimal('450.50'))
        self.assertEqual(lee['total_owed'], Decimal('400.00'))
        self.assertEqual(lee['balance'], Decimal('-50.50'))
        pat = self.graph.get('registration', self.made.r1.id)
        self.assertEqual(pat['pricing']['donation'], 25)
        self.assertEqual(pat['total_owed'], Decimal('825.00'))
        self.assertNotIn('campers', pat['pricing'])
        self.assertEqual(self.camper(self.made.c1)['pricing']['tuition'], 400)

    def test_pricing_numbers_print_as_they_did_in_json(self):
        from camphoric.templating.graph import number
        self.assertEqual(repr(number(825.0)), '825')
        self.assertEqual(number(102.27), Decimal('102.27'))
        self.assertEqual(number('x'), 'x')

    def test_dates(self):
        event = self.graph.event
        self.assertEqual(event['nights'][0], datetime.date(2026, 12, 30))
        self.assertEqual(len(event['nights']), 5)
        self.assertEqual(event['nights'][-1], datetime.date(2027, 1, 3))
        self.assertEqual(len(event['days']), 6)
        lee = self.camper(self.made.c3)
        self.assertEqual(lee['stay'][0], datetime.date(2026, 12, 30))
        self.assertEqual(lee['first_day'], datetime.date(2026, 12, 30))
        self.assertEqual(lee['last_day'], datetime.date(2027, 1, 1))
        created = self.graph.get('registration', self.made.r1.id)['created_at']
        self.assertEqual(str(created.tzinfo), 'America/Los_Angeles')

    def test_read_only_values(self):
        pat = self.camper(self.made.c1)
        self.assertIsInstance(pat['attributes'], ReadOnlyDict)
        self.assertIsInstance(pat['attributes']['emergency_contact'], ReadOnlyDict)
        self.assertIsInstance(pat['stay'], ReadOnlyList)
        self.assertEqual(str(pat), f'<camper {pat["id"]}>')

    @override_settings(CAMPHORIC_PUBLIC_URL='https://camp.example.org/')
    def test_invitations(self):
        graph = build_event_graph(self.made.event)
        invited = graph.get('invitation', self.made.invited.id)
        self.assertTrue(invited['redeemed'])
        self.assertIs(invited['registration'], graph.get('registration', self.made.r2.id))
        self.assertIs(graph.get('registration', self.made.r2.id)['invitation'], invited)
        pending = graph.get('invitation', self.made.pending.id)
        self.assertFalse(pending['redeemed'])
        self.assertEqual(
            pending['register_url'],
            f'https://camp.example.org/events/{self.made.event.id}/register'
            '?email=kim@example.com&code=wxyz6789')
        self.assertEqual(graph.event['register_url'],
                         f'https://camp.example.org/events/{self.made.event.id}/register')

    def test_soft_deleted_rows_are_left_out(self):
        self.made.c2.soft_delete()
        graph = build_event_graph(self.made.event)
        self.assertIsNone(graph.get('camper', self.made.c2.id))
        self.assertEqual(graph.get('registration', self.made.r1.id)['camper_count'], 1)

    def test_scoped_to_registrations(self):
        graph = build_event_graph(self.made.event, registration_ids=[self.made.r1.id])
        self.assertEqual([r['id'] for r in graph.registrations], [self.made.r1.id])
        self.assertEqual(len(graph.campers), 2)

    def test_query_count_does_not_grow_with_the_event(self):
        with CaptureQueriesContext(connection) as small:
            build_event_graph(self.made.event)

        for n in range(5):
            registration = models.Registration.objects.create(
                event=self.made.event, registrant_email=f'extra{n}@example.com',
                completed=True, payment_type='Check')
            for m in range(3):
                registration.campers.create(sequence=m, lodging=self.made.cabin_b,
                                            attributes={'first_name': f'E{n}{m}'})
            models.Payment.objects.create(registration=registration, amount=Decimal('10'))

        with CaptureQueriesContext(connection) as large:
            build_event_graph(self.made.event)

        self.assertEqual(len(large.captured_queries), len(small.captured_queries))
        self.assertLessEqual(len(small.captured_queries), 12)

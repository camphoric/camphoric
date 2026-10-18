'''
Posting a registration (RegisterView.post_registration): it's saved all or
nothing, and its campers are priced once, not once per camper saved (#806).
'''

from unittest import mock

from auditlog.models import LogEntry
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from camphoric import models
from tests.test_views import create_standard_test_event


class RegisterPostAtomicTests(APITestCase):
    def setUp(self):
        create_standard_test_event(self)
        root = self.event.lodging_set.create(name='Lodging', visible=True)
        self.cabin = self.event.lodging_set.create(name='Cabin', parent=root, visible=True)
        tent = self.event.lodging_set.create(name='Tent', parent=root, visible=True)
        # Registration only takes lodging with room (#795).
        self.cabin_1 = self.event.lodging_set.create(
            name='Cabin 1', parent=self.cabin, visible=True, capacity=4)
        self.tent_1 = self.event.lodging_set.create(
            name='Tent 1', parent=tent, visible=True, capacity=4)

        # A camper's price depends on where they come in the registration and
        # on their lodging's place in the tree, so each is priced among the rest.
        self.event.registration_pricing_logic = [
            {'var': 'registration_fee', 'exp': 25},
            {'var': 'total', 'exp': {'var': 'registration_fee'}},
        ]
        self.event.camper_pricing_logic = [
            {'var': 'tuition', 'exp': {'if': [{'==': [{'var': 'camper.index'}, 0]}, 300, 200]}},
            {'var': 'lodging_fee', 'exp': {'if': [
                {'in': [self.cabin.id, {'var': 'camper.lodging.lodging_requested.choices'}]},
                100, 50,
            ]}},
            {'var': 'total', 'exp': {'+': [{'var': 'tuition'}, {'var': 'lodging_fee'}]}},
        ]
        self.event.save()

    def form_data(self):
        def camper(name, lodging):
            choices = [ld.id for ld in lodging.get_parents()[1:]]
            return {'name': name,
                    'lodging': {'lodging_requested': {'id': lodging.id, 'choices': choices}}}

        return {
            **self.valid_form_data,
            'campers': [
                camper('First', self.cabin_1),
                camper('Second', self.tent_1),
                camper('Third', self.cabin_1),
            ],
        }

    def post(self, **body):
        return self.client.post(
            f'/api/events/{self.event.id}/register',
            {'formData': self.form_data(), 'pricingResults': {}, **body},
            format='json')

    def test_campers_are_priced_once_and_end_up_priced_together(self):
        expected = {
            'registration_fee': 25,
            'tuition': 700,
            'lodging_fee': 250,
            'total': 975,
            'campers': [
                {'tuition': 300, 'lodging_fee': 100, 'total': 400},
                {'tuition': 200, 'lodging_fee': 50, 'total': 250},
                {'tuition': 200, 'lodging_fee': 100, 'total': 300},
            ],
        }
        with CaptureQueriesContext(connection) as queries:
            response = self.post()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['serverPricingResults'], expected)

        registration = models.Registration.objects.get()
        campers = list(registration.campers.all())
        self.assertEqual(registration.server_pricing_results, expected)
        self.assertEqual([c.attributes['name'] for c in campers], ['First', 'Second', 'Third'])
        self.assertEqual([c.sequence for c in campers], [0, 1, 2])
        self.assertEqual(
            [c.server_pricing_results for c in campers], expected['campers'])
        # Nothing an admin did, so nothing counts as an edit (DR-109).
        self.assertEqual(registration.version, 1)
        self.assertEqual([c.version for c in campers], [1, 1, 1])

        # Saving a camper used to reprice the registration and re-save every
        # camper saved before it: N(N+1)/2 camper updates. Now it's one reprice.
        camper_updates = [
            q for q in queries.captured_queries
            if q['sql'].startswith('UPDATE "camphoric_camper"')]
        self.assertLessEqual(len(camper_updates), len(campers))

        # The history shows each record created with its final price, and no
        # repricing in between.
        entries = LogEntry.objects.get_for_object(registration)
        self.assertEqual([e.action for e in entries], [LogEntry.Action.CREATE])
        self.assertIn('"total": 975', entries[0].changes['server_pricing_results'][1])
        for camper in campers:
            entries = LogEntry.objects.get_for_object(camper)
            self.assertEqual([e.action for e in entries], [LogEntry.Action.CREATE], camper)
            self.assertIn(
                f'"total": {camper.server_pricing_results["total"]}',
                entries[0].changes['server_pricing_results'][1])

    def test_a_failure_partway_leaves_nothing_behind(self):
        invitation = models.Invitation.objects.create(
            registration_type=self.registration_type, recipient_email='staff@example.com')
        save = models.TimeStampedModel.save
        campers_saved = []

        def failing_save(instance, *args, **kwargs):
            if isinstance(instance, models.Camper) and instance.pk is None:
                campers_saved.append(instance)
                if len(campers_saved) == 2:
                    raise RuntimeError('database went away')
            return save(instance, *args, **kwargs)

        with mock.patch.object(models.TimeStampedModel, 'save', failing_save):
            with self.assertRaisesMessage(RuntimeError, 'database went away'):
                self.post(invitation={
                    'recipient_email': invitation.recipient_email,
                    'invitation_code': invitation.invitation_code,
                })

        self.assertFalse(models.Registration.all_objects.exists())
        self.assertFalse(models.Camper.all_objects.exists())
        invitation.refresh_from_db()
        self.assertIsNone(invitation.registration)
        self.assertEqual(invitation.version, 1)

        # Once whatever failed is fixed, the same invitation registers normally.
        response = self.post(invitation={
            'recipient_email': invitation.recipient_email,
            'invitation_code': invitation.invitation_code,
        })
        self.assertEqual(response.status_code, 200, response.data)
        registration = models.Registration.objects.get()
        self.assertEqual(registration.campers.count(), 3)
        invitation.refresh_from_db()
        self.assertEqual(invitation.registration, registration)

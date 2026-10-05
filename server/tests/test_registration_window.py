'''
The registration window is date + time, in the event's time zone (issue #744;
SPEC §8.3, DR-97): `registration_start` and `registration_end` are instants,
written with a UTC offset; registration is open from the start (inclusive)
until the end; and pricing and templates see them as days and times at camp.
'''

import datetime
import importlib
import zoneinfo

from django.apps import apps
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from freezegun import freeze_time
from rest_framework.test import APITestCase

from camphoric import models, pricing
from camphoric.templating.graph import build_event_graph

PACIFIC = zoneinfo.ZoneInfo('America/Los_Angeles')
UTC = datetime.timezone.utc

window_migration = importlib.import_module(
    'camphoric.migrations.0079_registration_window_times')


class IsOpenTests(TestCase):
    def setUp(self):
        organization = models.Organization.objects.create(name='Camp Org')
        self.event = models.Event.objects.create(
            organization=organization, name='Camp',
            registration_start=datetime.datetime(2026, 3, 1, 9, 0, tzinfo=PACIFIC),
            registration_end=datetime.datetime(2026, 12, 13, 14, 0, tzinfo=PACIFIC))

    def assertOpenAt(self, moment, expected):
        with freeze_time(moment):
            self.assertEqual(self.event.is_open(), expected, moment)

    def test_opens_at_its_start(self):
        self.assertOpenAt(datetime.datetime(2026, 3, 1, 8, 59, 59, tzinfo=PACIFIC), False)
        self.assertOpenAt(datetime.datetime(2026, 3, 1, 9, 0, tzinfo=PACIFIC), True)

    def test_closes_at_its_end(self):
        self.assertOpenAt(datetime.datetime(2026, 12, 13, 13, 59, 59, tzinfo=PACIFIC), True)
        self.assertOpenAt(datetime.datetime(2026, 12, 13, 14, 0, tzinfo=PACIFIC), False)

    def test_an_unset_end_never_closes(self):
        self.event.registration_end = None
        self.assertOpenAt(datetime.datetime(2400, 1, 1, tzinfo=UTC), True)


class EventApiTests(APITestCase):
    def setUp(self):
        admin = User.objects.create_superuser('tom', 'tom@example.com', 'password')
        self.client.force_authenticate(user=admin)
        organization = models.Organization.objects.create(name='Camp Org')
        self.event = models.Event.objects.create(organization=organization, name='Camp')

    def patch(self, data, status=200):
        response = self.client.patch(f'/api/events/{self.event.id}/', data, format='json')
        self.assertEqual(response.status_code, status, response.data)
        return response

    def test_a_new_event_is_in_the_template_time_zone(self):
        self.assertEqual(self.event.time_zone, 'America/Los_Angeles')
        with override_settings(CAMPHORIC_TEMPLATE_TIMEZONE='America/Chicago'):
            other = models.Event.objects.create(organization=self.event.organization)
        self.assertEqual(other.time_zone, 'America/Chicago')

    def test_a_time_with_an_offset_reads_back_as_the_same_instant(self):
        response = self.patch({'registration_end': '2026-12-13T14:00:00-08:00'})
        closes = datetime.datetime(2026, 12, 13, 22, 0, tzinfo=UTC)
        self.assertEqual(response.data['registration_end'], '2026-12-13T22:00:00Z')
        self.event.refresh_from_db()
        self.assertEqual(self.event.registration_end, closes)

        read = self.client.get(f'/api/events/{self.event.id}/').data['registration_end']
        self.assertEqual(datetime.datetime.fromisoformat(read), closes)

    def test_a_time_without_an_offset_is_refused(self):
        for naive in ('2026-12-13 14:00:00', '2026-12-13T14:00:00', '2026-12-13'):
            with self.subTest(naive=naive):
                response = self.patch({'registration_start': naive}, status=400)
                self.assertIn('UTC offset', str(response.data['registration_start'][0]))

    def test_a_cleared_time_is_null(self):
        self.patch({'registration_end': '2026-12-13T14:00:00Z'})
        response = self.patch({'registration_end': None})
        self.assertIsNone(response.data['registration_end'])

    def test_the_time_zone_must_be_a_real_one(self):
        self.assertEqual(
            self.patch({'time_zone': 'America/Denver'}).data['time_zone'], 'America/Denver')
        response = self.patch({'time_zone': 'Pacific Time'}, status=400)
        self.assertIn('time zone', str(response.data['time_zone'][0]))


class CampDayTests(TestCase):
    '''After 4 PM in California it's already the next day in UTC; camp's day is the one shown.'''

    def setUp(self):
        organization = models.Organization.objects.create(name='Camp Org')
        self.closes = datetime.datetime(2026, 12, 13, 20, 0, tzinfo=PACIFIC)
        self.event = models.Event.objects.create(
            organization=organization, name='Camp', registration_end=self.closes)

    def test_pricing_gets_the_day_at_camp(self):
        closes = pricing.get_event_attributes(self.event)['registration_end']
        self.assertEqual(closes, {
            'year': 2026, 'month': 12, 'day': 13, 'epoch': int(self.closes.timestamp())})

    def test_templates_get_the_time_at_camp(self):
        closes = build_event_graph(self.event).event['registration_end']
        self.assertEqual(closes, self.closes)
        self.assertEqual((closes.day, closes.hour), (13, 20))


class MigrationTests(TestCase):
    '''Existing events move to San Francisco's zone, their dates to midnight there.'''

    def setUp(self):
        organization = models.Organization.objects.create(name='Camp Org')
        # How a date reads once its column has become a datetime: midnight UTC.
        self.event = models.Event.objects.create(
            organization=organization, name='Camp', time_zone='America/Chicago',
            registration_start=datetime.datetime(2026, 3, 1, tzinfo=UTC),
            registration_end=datetime.datetime(2026, 12, 13, tzinfo=UTC))
        self.undated = models.Event.objects.create(organization=organization, name='Undated')

    def test_dates_become_midnight_in_san_francisco(self):
        window_migration.to_local_midnight(apps, None)
        self.event.refresh_from_db()
        self.assertEqual(self.event.time_zone, 'America/Los_Angeles')
        self.assertEqual(
            self.event.registration_start, datetime.datetime(2026, 3, 1, tzinfo=PACIFIC))
        self.assertEqual(
            self.event.registration_end, datetime.datetime(2026, 12, 13, tzinfo=PACIFIC))
        self.undated.refresh_from_db()
        self.assertEqual(self.undated.time_zone, 'America/Los_Angeles')
        self.assertIsNone(self.undated.registration_end)

    def test_going_back_keeps_the_day_at_camp(self):
        window_migration.to_local_midnight(apps, None)
        window_migration.to_utc_midnight(apps, None)
        self.event.refresh_from_db()
        self.assertEqual(self.event.registration_end, datetime.datetime(2026, 12, 13, tzinfo=UTC))

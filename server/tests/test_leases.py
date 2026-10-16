'''
Edit leases (SPEC §9.8, DR-110): who is editing a record, taken by a browser tab
when its user starts changing it, renewed while they go on, lapsing when not
renewed, and open to takeover. They never stop a save.
'''

from datetime import timedelta

from django.utils import timezone
from freezegun import freeze_time
from rest_framework.test import APIClient, APITestCase

from camphoric import cleanup, leases, models, roles
from tests.factories import create_template_event, make_user


class LeaseTestCase(APITestCase):
    def setUp(self):
        self.made = create_template_event()
        self.reggie = make_user(roles.REGISTRAR, 'reggie', first_name='Reggie')
        self.alex = make_user(roles.REGISTRAR, 'alex')
        self.client.force_authenticate(self.reggie)

    def take(self, client_id='tab-1', takeover=False, model='camper', object_id=None,
             client=None):
        return (client or self.client).post('/api/leases/', {
            'model': model,
            'object_id': object_id or self.made.c1.id,
            'client_id': client_id,
            'takeover': takeover,
        }, format='json')

    def as_alex(self):
        client = APIClient()
        client.force_authenticate(self.alex)
        return client


class AcquireTests(LeaseTestCase):
    def test_taking_a_lease_says_who_holds_it_until_when(self):
        with freeze_time('2026-10-15 12:00:00'):
            response = self.take()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['model'], 'camper')
        self.assertEqual(response.data['object_id'], self.made.c1.id)
        self.assertEqual(response.data['event'], self.made.event.id)
        self.assertEqual(response.data['holder'], {'id': self.reggie.id, 'name': 'Reggie'})
        self.assertEqual(response.data['client_id'], 'tab-1')
        self.assertEqual(response.data['expires_at'], '2026-10-15T12:01:30Z')

    def test_the_same_tab_renews_it(self):
        with freeze_time('2026-10-15 12:00:00'):
            first = self.take()
        with freeze_time('2026-10-15 12:00:30'):
            renewed = self.take()
        self.assertEqual(renewed.data['id'], first.data['id'])
        self.assertEqual(renewed.data['acquired_at'], first.data['acquired_at'])
        self.assertEqual(renewed.data['expires_at'], '2026-10-15T12:02:00Z')

    def test_another_tab_is_told_who_holds_it(self):
        self.take()
        response = self.take('tab-2', client=self.as_alex())
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'lease_held')
        self.assertEqual(response.data['lease']['holder']['name'], 'Reggie')
        self.assertEqual(response.data['detail'], 'Reggie is editing this.')

    def test_a_lapsed_lease_goes_to_whoever_asks(self):
        with freeze_time('2026-10-15 12:00:00'):
            self.take()
        with freeze_time('2026-10-15 12:01:31'):
            response = self.take('tab-2', client=self.as_alex())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['holder']['id'], self.alex.id)
        self.assertEqual(response.data['acquired_at'], '2026-10-15T12:01:31Z')

    def test_taking_over_tells_the_holder_at_their_next_renewal(self):
        self.take()
        response = self.take('tab-2', takeover=True, client=self.as_alex())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['holder']['id'], self.alex.id)

        renewal = self.take('tab-1')
        self.assertEqual(renewal.status_code, 409)
        self.assertEqual(renewal.data['lease']['holder']['id'], self.alex.id)

    def test_one_lease_per_record_kind_and_id(self):
        self.take(model='camper', object_id=self.made.c1.id)
        other = self.take('tab-2', model='camper', object_id=self.made.c2.id,
                          client=self.as_alex())
        registration = self.take('tab-2', model='registration', object_id=self.made.r1.id,
                                 client=self.as_alex())
        self.assertEqual((other.status_code, registration.status_code), (200, 200))
        self.assertEqual(registration.data['event'], self.made.event.id)

    def test_what_it_names_must_exist(self):
        self.assertEqual(self.take(model='camper', object_id=999999).status_code, 404)
        self.assertEqual(self.take(model='user', object_id=self.alex.id).status_code, 404)
        self.assertEqual(self.take(client_id='').status_code, 400)

    def test_a_reporter_sees_leases_but_cant_take_one(self):
        self.take()
        reporter = APIClient()
        reporter.force_authenticate(make_user(roles.REPORTER, 'rita'))
        self.assertEqual(self.take('tab-9', client=reporter).status_code, 403)
        listed = reporter.get(f'/api/leases/?event={self.made.event.id}')
        self.assertEqual([lease['holder']['name'] for lease in listed.data], ['Reggie'])

    def test_a_lease_never_stops_a_save(self):
        self.take()
        alex = self.as_alex()
        response = alex.patch(f'/api/campers/{self.made.c1.id}/',
                              {'admin_attributes': {'note': 'x'}}, format='json')
        self.assertEqual(response.status_code, 200)


class ListAndReleaseTests(LeaseTestCase):
    def test_lists_the_live_leases_of_an_event_or_a_record(self):
        with freeze_time('2026-10-15 12:00:00'):
            self.take(object_id=self.made.c1.id)
        with freeze_time('2026-10-15 12:01:00'):
            self.take('tab-2', object_id=self.made.c2.id)
            by_event = self.client.get(f'/api/leases/?event={self.made.event.id}')
            by_record = self.client.get(
                f'/api/leases/?model=camper&object_id={self.made.c2.id}')
        with freeze_time('2026-10-15 12:01:45'):
            later = self.client.get(f'/api/leases/?event={self.made.event.id}')
        self.assertEqual([lease['object_id'] for lease in by_event.data],
                         [self.made.c1.id, self.made.c2.id])
        self.assertEqual([lease['object_id'] for lease in by_record.data], [self.made.c2.id])
        self.assertEqual([lease['object_id'] for lease in later.data], [self.made.c2.id])

    def test_a_list_needs_an_event_or_a_record(self):
        self.assertEqual(self.client.get('/api/leases/').status_code, 400)

    def test_only_its_tab_gives_it_up(self):
        lease = self.take().data
        self.client.delete(f'/api/leases/{lease["id"]}/?client_id=tab-2')
        self.assertTrue(models.EditLease.objects.filter(pk=lease['id']).exists())
        response = self.client.delete(f'/api/leases/{lease["id"]}/?client_id=tab-1')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(models.EditLease.objects.filter(pk=lease['id']).exists())

    def test_the_nightly_clean_up_purges_lapsed_leases(self):
        self.take(object_id=self.made.c1.id)
        lapsed = models.EditLease.objects.get()
        lapsed.expires_at = timezone.now() - timedelta(seconds=1)
        lapsed.save()
        self.take(object_id=self.made.c2.id)
        self.assertEqual(leases.purge_lapsed(), 1)
        self.assertEqual(models.EditLease.objects.count(), 1)
        self.assertIn('purged_leases', cleanup.clean_up.call())


class EdgeTests(LeaseTestCase):
    def test_malformed_ids_are_refused_not_errors(self):
        self.assertEqual(self.client.get('/api/leases/?event=abc').status_code, 400)
        self.assertEqual(self.client.delete('/api/leases/abc/?client_id=tab-1').status_code, 404)

    def test_a_delete_preview_leaves_out_who_is_editing(self):
        self.take(model='camper', object_id=self.made.c4.id)
        admin = APIClient()
        admin.force_authenticate(make_user(roles.ADMIN, 'ada'))
        preview = admin.get(f'/api/users/{self.reggie.id}/delete-preview/')
        self.assertEqual(preview.status_code, 200)
        self.assertTrue(preview.data['can_delete'])
        self.assertNotIn('edit lease', str(preview.data).lower())

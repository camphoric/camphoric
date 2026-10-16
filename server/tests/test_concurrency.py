'''
Optimistic concurrency (SPEC §5, DR-109): every record counts its edits in
`version`; a write that sends `If-Match` with a version the record has moved on
from is refused with 412 and the record as it is now, so an edit is never saved
over without being seen.
'''

from decimal import Decimal
import threading
from unittest import mock

from auditlog.models import LogEntry
from django.db import connection
from django.test import TransactionTestCase
from rest_framework.test import APIClient, APITestCase

from camphoric import models, roles
from tests.factories import create_template_event, make_user


class VersionTestCase(APITestCase):
    def setUp(self):
        self.made = create_template_event()
        self.client.force_authenticate(make_user(roles.REGISTRAR, 'reggie'))

    def version(self, row):
        return type(row)._base_manager.get(pk=row.pk).version

    def patch(self, path, data, if_match=None):
        headers = {} if if_match is None else {'HTTP_IF_MATCH': if_match}
        return self.client.patch(path, data, format='json', **headers)


class BumpTests(VersionTestCase):
    def test_a_new_record_starts_at_one(self):
        lodging = models.Lodging.objects.create(event=self.made.event, name='Tents')
        self.assertEqual(lodging.version, 1)

    def test_each_save_counts_and_the_instance_knows_the_new_number(self):
        lodging = self.made.cabin_a
        before = self.version(lodging)
        lodging.name = 'Cabin Alpha'
        lodging.save()
        self.assertEqual(lodging.version, before + 1)
        self.assertEqual(self.version(lodging), before + 1)

    def test_a_save_of_some_fields_counts_too(self):
        lodging = self.made.cabin_a
        before = self.version(lodging)
        lodging.capacity = 6
        lodging.save(update_fields=['capacity'])
        self.assertEqual(self.version(lodging), before + 1)

    def test_soft_delete_and_restore_count(self):
        registration = self.made.r3
        before = self.version(registration)
        registration.soft_delete()
        registration.soft_undelete()
        self.assertEqual(self.version(registration), before + 2)

    def test_two_stale_copies_saved_in_turn_still_count_twice(self):
        first = models.Lodging.objects.get(pk=self.made.cabin_a.pk)
        second = models.Lodging.objects.get(pk=self.made.cabin_a.pk)
        before = first.version
        first.save()
        second.save()
        self.assertEqual(self.version(first), before + 2)

    def test_editing_a_camper_leaves_its_registration_and_siblings_alone(self):
        made = self.made
        registration, sibling = self.version(made.r1), self.version(made.c2)
        response = self.patch(f'/api/campers/{made.c1.id}/',
                              {'attributes': {**made.c1.attributes, 'first_name': 'Pattie'}})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.version(made.r1), registration)
        self.assertEqual(self.version(made.c2), sibling)

    def test_editing_a_registration_counts_once_and_leaves_its_campers_alone(self):
        made = self.made
        before, camper = self.version(made.r1), self.version(made.c1)
        response = self.patch(f'/api/registrations/{made.r1.id}/',
                              {'registrant_email': 'pat@example.org'})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['version'], before + 1)
        self.assertEqual(self.version(made.r1), before + 1)
        self.assertEqual(self.version(made.c1), camper)

    def test_a_pricing_recalculation_from_a_stale_copy_undoes_nothing(self):
        made = self.made
        stale = models.Registration.objects.get(pk=made.r1.pk)
        made.r1.registrant_email = 'pat@example.org'
        made.r1.save()
        edited = self.version(made.r1)
        stale.recalculate_server_pricing()
        registration = models.Registration.objects.get(pk=made.r1.pk)
        self.assertEqual(registration.version, edited)
        self.assertEqual(registration.registrant_email, 'pat@example.org')

    def test_saving_a_camper_leaves_a_siblings_edit_alone(self):
        made = self.made
        camper = models.Camper.objects.get(pk=made.c1.pk)
        camper.registration  # its registration, and so its siblings, read before the edit
        sibling = models.Camper.objects.get(pk=made.c2.pk)
        sibling.attributes = {**sibling.attributes, 'first_name': 'Edited'}
        sibling.save()
        camper.save()
        self.assertEqual(
            models.Camper.objects.get(pk=made.c2.pk).attributes['first_name'], 'Edited')

    def test_saving_no_fields_saves_nothing(self):
        lodging = self.made.cabin_a
        before = self.version(lodging)
        lodging.save(update_fields=[])
        self.assertEqual(self.version(lodging), before)

    def test_the_audit_log_leaves_the_version_out(self):
        lodging = self.made.cabin_a
        lodging.name = 'Cabin Alpha'
        lodging.save()
        entry = LogEntry.objects.get_for_object(lodging).latest('timestamp')
        self.assertNotIn('version', entry.changes_dict)


class IfMatchTests(VersionTestCase):
    def path(self):
        return f'/api/lodgings/{self.made.cabin_a.id}/'

    def test_responses_carry_the_version(self):
        response = self.client.get(self.path())
        version = self.version(self.made.cabin_a)
        self.assertEqual(response.data['version'], version)
        self.assertEqual(response['ETag'], f'"{version}"')
        listed = self.client.get(f'/api/lodgings/?event={self.made.event.id}')
        self.assertTrue(all('version' in row for row in listed.data))
        self.assertNotIn('ETag', listed)

    def test_the_version_cant_be_written(self):
        version = self.version(self.made.cabin_a)
        response = self.patch(self.path(), {'version': 99})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['version'], version + 1)

    def test_a_matching_version_saves_and_answers_the_new_one(self):
        version = self.version(self.made.cabin_a)
        response = self.patch(self.path(), {'name': 'Cabin Alpha'}, f'"{version}"')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['version'], version + 1)
        self.assertEqual(response['ETag'], f'"{version + 1}"')

    def test_a_stale_version_is_refused_with_the_record_as_it_is(self):
        version = self.version(self.made.cabin_a)
        self.patch(self.path(), {'name': 'Cabin Alpha'}, f'"{version}"')

        response = self.patch(self.path(), {'name': 'Cabin Zed'}, f'"{version}"')
        self.assertEqual(response.status_code, 412)
        self.assertEqual(response.data['code'], 'version_conflict')
        self.assertEqual(response.data['current']['name'], 'Cabin Alpha')
        self.assertEqual(response.data['current']['version'], version + 1)
        self.assertEqual(response['ETag'], f'"{version + 1}"')
        self.assertEqual(models.Lodging.objects.get(pk=self.made.cabin_a.pk).name, 'Cabin Alpha')

    def test_without_if_match_the_write_goes_ahead(self):
        self.patch(self.path(), {'name': 'Cabin Alpha'})
        response = self.patch(self.path(), {'name': 'Cabin Zed'})
        self.assertEqual(response.status_code, 200)

    def test_weak_bare_listed_and_star_tags_are_understood(self):
        version = self.version(self.made.cabin_a)
        for tag in (f'W/"{version}"', f'{version + 1}', f'"7", "{version + 2}"', '*'):
            response = self.patch(self.path(), {'capacity': 5}, tag)
            self.assertEqual(response.status_code, 200, tag)

    def test_a_tag_that_isnt_a_version_never_matches(self):
        response = self.patch(self.path(), {'capacity': 5}, '"abc"')
        self.assertEqual(response.status_code, 412)

    def test_a_stale_delete_is_refused_and_nothing_is_deleted(self):
        made = self.made
        version = self.version(made.r3)
        self.patch(f'/api/registrations/{made.r3.id}/', {'registrant_email': 'd@example.org'})
        response = self.client.delete(f'/api/registrations/{made.r3.id}/',
                                      HTTP_IF_MATCH=f'"{version}"')
        self.assertEqual(response.status_code, 412)
        self.assertIsNone(models.Registration.all_objects.get(pk=made.r3.pk).deleted_at)

        response = self.client.delete(f'/api/registrations/{made.r3.id}/',
                                      HTTP_IF_MATCH=f'"{version + 1}"')
        self.assertEqual(response.status_code, 204)

    def test_a_missing_record_is_still_404(self):
        response = self.patch('/api/lodgings/999999/', {'name': 'x'}, '"1"')
        self.assertEqual(response.status_code, 404)


class InvoiceTests(VersionTestCase):
    def setUp(self):
        super().setUp()
        self.invoice = models.Invoice.objects.create(
            registration=self.made.r1, origin=models.InvoiceOrigin.ADMIN,
            description='Extra night', amount=Decimal('50.00'))
        self.path = f'/api/invoices/{self.invoice.id}/'

    def test_an_edit_checks_the_version(self):
        version = self.version(self.invoice)
        response = self.patch(self.path, {'description': 'Two nights'}, f'"{version}"')
        self.assertEqual(response.status_code, 200, response.data)
        response = self.patch(self.path, {'description': 'Three nights'}, f'"{version}"')
        self.assertEqual(response.status_code, 412)
        self.assertEqual(response.data['current']['description'], 'Two nights')

    def test_cancel_and_reopen_check_the_version(self):
        version = self.version(self.invoice)
        self.patch(self.path, {'description': 'Two nights'})
        response = self.client.post(f'{self.path}cancel/', {}, format='json',
                                    HTTP_IF_MATCH=f'"{version}"')
        self.assertEqual(response.status_code, 412)
        self.assertIsNone(models.Invoice.objects.get(pk=self.invoice.pk).cancelled_at)

        response = self.client.post(f'{self.path}cancel/', {}, format='json',
                                    HTTP_IF_MATCH=f'"{version + 1}"')
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.post(f'{self.path}reopen/', {}, format='json',
                                    HTTP_IF_MATCH=f'"{version + 1}"')
        self.assertEqual(response.status_code, 412)


class SimultaneousWriteTests(TransactionTestCase):
    '''
    Writes to one registration's records at the same moment wait their turn
    rather than deadlock: each takes the registration's row before its own.
    '''

    def run_together(self, *requests):
        '''Run (method, path, data) requests in threads that meet just before repricing.'''
        user = make_user(roles.REGISTRAR, 'reggie')
        barrier = threading.Barrier(len(requests), timeout=2)
        reprice = models.Registration.recalculate_server_pricing

        def meet_then_reprice(registration):
            if threading.current_thread().name.startswith('write-'):
                try:
                    barrier.wait()
                except threading.BrokenBarrierError:
                    pass  # the other is waiting for the registration: as it should
            return reprice(registration)

        results = {}

        def send(index, method, path, data):
            client = APIClient()
            client.force_authenticate(user)
            try:
                results[index] = getattr(client, method)(path, data, format='json').status_code
            except Exception as error:
                results[index] = repr(error)
            finally:
                connection.close()

        threads = [threading.Thread(target=send, args=(i, *request), name=f'write-{i}')
                   for i, request in enumerate(requests)]
        with mock.patch.object(models.Registration, 'recalculate_server_pricing',
                               meet_then_reprice):
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(30)
        return [results[i] for i in range(len(requests))]

    def test_two_campers_of_one_registration(self):
        made = create_template_event()
        self.assertEqual(self.run_together(
            ('patch', f'/api/campers/{made.c1.id}/', {'admin_attributes': {'note': 1}}),
            ('patch', f'/api/campers/{made.c2.id}/', {'admin_attributes': {'note': 2}}),
        ), [200, 200])

    def test_a_registration_and_one_of_its_campers(self):
        made = create_template_event()
        self.assertEqual(self.run_together(
            ('patch', f'/api/registrations/{made.r1.id}/', {'registrant_email': 'p@example.org'}),
            ('patch', f'/api/campers/{made.c1.id}/', {'admin_attributes': {'note': 1}}),
        ), [200, 200])

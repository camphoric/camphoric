'''
The audit log of admin changes (camphoric.audit, SPEC DR-54): who is credited,
what's recorded and left out, and the registration and camper histories.
'''

import datetime
from decimal import Decimal
from importlib import import_module

from auditlog.models import LogEntry
from django.apps import apps
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from camphoric import cleanup, models, roles
from tests.factories import create_template_event, make_user


def entries_for(instance):
    return LogEntry.objects.get_for_object(instance).order_by('id')


class CreditTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()
        cls.registrar = make_user(roles.REGISTRAR, 'reggie')

    def patch_registration(self):
        return self.client.patch(
            f'/api/registrations/{self.made.r1.id}/',
            {'attributes': {**self.made.r1.attributes, 'comments': 'Changed'}}, format='json')

    def last_edit(self):
        return entries_for(self.made.r1).filter(changes__has_key='attributes').last()

    def test_a_signed_in_admin_edit_records_who_and_what(self):
        self.client.login(username='reggie', password='password')
        response = self.patch_registration()
        self.assertEqual(response.status_code, 200, response.data)

        entry = self.last_edit()
        self.assertEqual(entry.actor, self.registrar)
        self.assertEqual(entry.action, LogEntry.Action.UPDATE)
        self.assertIn('"comments": "Hi"', entry.changes['attributes'][0])
        self.assertIn('"comments": "Changed"', entry.changes['attributes'][1])
        self.assertIsNotNone(entry.cid)

    def test_an_api_token_is_credited(self):
        token = Token.objects.create(user=self.registrar)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        self.assertEqual(self.patch_registration().status_code, 200)
        self.assertEqual(self.last_edit().actor, self.registrar)

    def test_the_pricing_an_edit_recalculates_shares_its_request_id(self):
        self.client.force_authenticate(self.registrar)
        response = self.client.patch(
            f'/api/registrations/{self.made.r1.id}/',
            {'attributes': {**self.made.r1.attributes, 'campership_donation': 50}}, format='json')
        self.assertEqual(response.status_code, 200, response.data)

        edit = self.last_edit()
        pricing = entries_for(self.made.r1).filter(changes__has_key='server_pricing_results').last()
        self.assertEqual(pricing.cid, edit.cid)
        self.assertEqual(pricing.actor, self.registrar)

    def test_a_public_registration_has_no_one_to_credit(self):
        event = self.made.event
        response = self.client.post(f'/api/events/{event.id}/register', {
            'formData': {'registrant_email': 'new@example.com', 'campers': [{'first_name': 'Al'}]},
            'pricingResults': {},
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        registration = models.Registration.objects.get(registrant_email='new@example.com')
        response = self.client.post(f'/api/events/{event.id}/register', {
            'step': 'payment', 'registrationUUID': str(registration.uuid),
            'paymentType': 'Check',
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        created = entries_for(registration).get(action=LogEntry.Action.CREATE)
        self.assertIsNone(created.actor)

    def test_a_delete_is_recorded(self):
        report = models.Report.objects.create(event=self.made.event, title='Old', template='x')
        self.client.force_authenticate(self.registrar)
        self.assertEqual(self.client.delete(f'/api/reports/{report.id}/').status_code, 204)
        entry = LogEntry.objects.get(
            object_repr=str(report), action=LogEntry.Action.DELETE)
        self.assertEqual(entry.actor, self.registrar)


class WhatIsRecordedTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()

    def test_paypal_replies_are_left_out_and_pricing_kept(self):
        registration = self.made.r1
        registration.attributes = {**registration.attributes, 'campership_donation': 75}
        registration.save()
        payment = models.Payment.objects.create(
            registration=registration, amount=1, payment_type='PayPal',
            paypal_response={'payer': {'name': 'Pat'}})

        changed = set().union(*(entry.changes for entry in entries_for(registration)))
        self.assertIn('server_pricing_results', changed)
        self.assertNotIn('updated_at', changed)
        changed = set().union(*(entry.changes for entry in entries_for(payment)))
        self.assertIn('amount', changed)
        self.assertNotIn('paypal_response', changed)

    def test_an_invoices_link_code_is_left_out(self):
        invoice = models.Invoice.objects.create(
            registration=self.made.r1, origin='admin', amount=10)
        changed = set().union(*(entry.changes for entry in entries_for(invoice)))
        self.assertIn('amount', changed)
        self.assertNotIn('token', changed)

    def test_role_changes_are_recorded_and_passwords_never(self):
        admin = make_user(roles.ADMIN, 'boss')
        user = make_user(roles.REPORTER, 'pat')
        self.client.force_authenticate(admin)
        response = self.client.patch(f'/api/users/{user.id}/', {'role': 'registrar'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        user.set_password('Another-horse-battery-7')
        user.save()

        entries = entries_for(user)
        groups = [e.changes['groups'] for e in entries if 'groups' in (e.changes or {})]
        self.assertIn({'type': 'm2m', 'operation': 'add', 'objects': ['Registrar']}, groups)
        self.assertTrue(all('password' not in (e.changes or {}) for e in entries))


class HistoryTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()
        cls.registrar = make_user(roles.REGISTRAR, 'reggie')

    def history(self, path):
        self.client.force_authenticate(self.registrar)
        response = self.client.get(path)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_a_registration_includes_its_campers_payments_and_charges(self):
        charge = models.CustomCharge.objects.create(
            custom_charge_type=self.made.linens, camper=self.made.c2, amount=Decimal('10.00'))
        charge_id = charge.id
        charge.delete()  # still in the history once it's gone

        entries = self.history(f'/api/registrations/{self.made.r1.id}/history/')
        types = {entry['object']['type'] for entry in entries}
        self.assertEqual(types, {'registration', 'camper', 'invoice', 'payment', 'customcharge'})
        labels = {entry['object']['label'] for entry in entries}
        self.assertIn('Sam Alpha', labels)
        self.assertIn('Check payment $100.00', labels)
        charge_object = {'type': 'customcharge', 'id': charge_id, 'label': 'Linens $10.00'}
        deleted = [e for e in entries if e['object'] == charge_object]
        self.assertEqual([e['action'] for e in deleted], ['delete', 'create'])
        # Nothing from another registration.
        self.assertNotIn('Lee Beta', labels)

    def test_values_come_back_decoded_newest_first(self):
        camper = self.made.c2
        camper.attributes = {**camper.attributes, 'linens': True}
        camper.save()

        entries = self.history(f'/api/campers/{camper.id}/history/')
        timestamps = [entry['timestamp'] for entry in entries]
        self.assertEqual(timestamps, sorted(timestamps, reverse=True))
        edit = next(e for e in entries if 'attributes' in e['changes'] and e['action'] == 'update')
        old, new = edit['changes']['attributes']
        self.assertEqual(old, {'first_name': 'Sam', 'last_name': 'Alpha'})
        self.assertEqual(new['linens'], True)
        self.assertIsNone(edit['actor'])

    def test_an_entry_for_a_field_since_removed_still_reads(self):
        entry = entries_for(self.made.r1).first()
        entry.changes = {**entry.changes, 'removed_field': ['None', 'kept']}
        entry.save()

        entries = self.history(f'/api/registrations/{self.made.r1.id}/history/')
        changes = next(e['changes'] for e in entries if e['id'] == entry.id)
        self.assertEqual(changes['removed_field'], [None, 'kept'])

    def test_a_camper_has_its_own_charges_but_not_other_campers(self):
        entries = self.history(f'/api/campers/{self.made.c1.id}/history/')
        labels = {entry['object']['label'] for entry in entries}
        self.assertIn('Pat Alpha', labels)
        self.assertIn('Linens $25.00', labels)
        self.assertNotIn('Sam Alpha', labels)

    def test_soft_delete_and_restore_read_as_such(self):
        camper = models.Camper.objects.get(id=self.made.c2.id)
        camper.soft_delete()
        camper.soft_undelete()

        actions = [e['action'] for e in self.history(f'/api/campers/{camper.id}/history/')
                   if e['object']['type'] == 'camper']
        self.assertEqual(actions[:2], ['restore', 'delete'])

    def test_a_deleted_user_is_named_by_their_email(self):
        self.client.force_authenticate(self.registrar)
        self.client.delete(f'/api/campers/{self.made.c2.id}/')
        self.registrar.delete()
        self.client.force_authenticate(make_user(roles.ADMIN, 'boss'))
        response = self.client.get(f'/api/registrations/{self.made.r1.id}/history/')
        deleted = next(e for e in response.data if e['action'] == 'delete')
        self.assertEqual(deleted['actor'],
                         {'id': None, 'username': None, 'name': 'reggie@example.com'})

    def test_only_registrars_and_admins(self):
        path = f'/api/registrations/{self.made.r1.id}/history/'
        self.assertEqual(self.client.get(path).status_code, 401)
        for role, status in ((roles.REPORTER, 403), (None, 403), (roles.ADMIN, 200)):
            with self.subTest(role=role):
                self.client.force_authenticate(make_user(role, f'user-{role}'))
                self.assertEqual(self.client.get(path).status_code, status)
        self.client.force_authenticate(User.objects.create_superuser('root', 'r@x.org', 'pw'))
        self.assertEqual(self.client.get(f'/api/campers/{self.made.c1.id}/history/').status_code,
                         200)


class FromCompletionTests(APITestCase):
    '''Nothing is logged for a registration until it's completed (SPEC DR-139).'''

    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()
        cls.registrar = make_user(roles.REGISTRAR, 'reggie')

    def started(self):
        registration = models.Registration.objects.create(
            event=self.made.event, registrant_email='new@example.com',
            attributes={'comments': 'Hello'})
        models.Camper.objects.create(
            registration=registration, attributes={'first_name': 'Al', 'last_name': 'Gamma'})
        return models.Registration.objects.get(id=registration.id)

    def logged(self, registration):
        return LogEntry.objects.filter(additional_data__registration=registration.id)

    def complete_by_admin(self, registration):
        self.client.force_authenticate(self.registrar)
        response = self.client.patch(
            f'/api/registrations/{registration.id}/', {'completed': True}, format='json')
        self.assertEqual(response.status_code, 200, response.data)

    def test_starting_editing_and_deleting_an_incomplete_one_log_nothing(self):
        registration = self.started()
        camper = registration.campers.get()
        charge = models.CustomCharge.objects.create(
            custom_charge_type=self.made.linens, camper=camper, amount=Decimal('10.00'))
        override = models.PricingOverride.objects.create(
            registration=registration, camper=camper, var='tuition', amount=Decimal('1.00'),
            reason='Why not')
        payment = models.Payment.objects.create(registration=registration, amount=Decimal('5.00'))
        registration.attributes = {'comments': 'Changed'}
        registration.save()
        payment.soft_delete()
        override.delete()
        charge.delete()
        camper.soft_delete()
        registration.soft_delete()
        self.assertFalse(self.logged(registration).exists())

    def test_a_hard_delete_of_an_incomplete_one_logs_nothing(self):
        registration = self.started()
        registration_id = registration.id
        registration.delete()
        self.assertFalse(LogEntry.objects.filter(
            additional_data__registration=registration_id).exists())

    def test_the_payment_step_starts_the_history(self):
        registration = self.started()
        response = self.client.post(f'/api/events/{self.made.event.id}/register', {
            'step': 'payment', 'registrationUUID': str(registration.uuid),
            'paymentType': 'Check',
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)

        created = entries_for(registration).filter(action=LogEntry.Action.CREATE).get()
        self.assertEqual(created.changes['completed'], ['None', 'True'])
        self.assertEqual(created.changes['registrant_email'], ['None', 'new@example.com'])
        camper = entries_for(registration.campers.get()).get()
        self.assertEqual(camper.action, LogEntry.Action.CREATE)
        self.assertIn('"first_name": "Al"', camper.changes['attributes'][1])
        self.assertEqual(camper.additional_data['registration'], registration.id)
        # The history opens with the whole record, not a diff.
        first = self.logged(registration).order_by('id').first()
        self.assertEqual(first, created)
        self.assertFalse(entries_for(registration).filter(
            action=LogEntry.Action.UPDATE, changes__completed=['False', 'True']).exists())

    def test_an_admin_setting_completed_starts_the_history_and_is_credited(self):
        registration = self.started()
        self.complete_by_admin(registration)
        created = entries_for(registration).get(action=LogEntry.Action.CREATE)
        self.assertEqual(created.actor, self.registrar)
        self.assertEqual(entries_for(registration.campers.get()).get().actor, self.registrar)

    def test_records_from_before_completion_are_logged_at_completion(self):
        registration = self.started()
        camper = registration.campers.get()
        models.CustomCharge.objects.create(
            custom_charge_type=self.made.linens, camper=camper, amount=Decimal('10.00'))
        models.PricingOverride.objects.create(
            registration=registration, camper=camper, var='tuition', amount=Decimal('1.00'),
            reason='Why not')
        models.Payment.objects.create(registration=registration, amount=Decimal('5.00'))
        self.assertFalse(self.logged(registration).exists())

        self.complete_by_admin(registration)
        created = self.logged(registration).filter(action=LogEntry.Action.CREATE)
        self.assertEqual(
            sorted(entry.content_type.model for entry in created),
            ['camper', 'customcharge', 'invoice', 'payment', 'pricingoverride', 'registration'])

    def test_what_was_deleted_before_completion_stays_out_of_the_history(self):
        registration = self.started()
        models.Camper.objects.create(
            registration=registration, attributes={'first_name': 'Gone'}).soft_delete()
        self.complete_by_admin(registration)
        campers = self.logged(registration).filter(
            content_type__model='camper').values_list('object_repr', flat=True)
        self.assertEqual(list(campers), ['Al Gamma'])

    def test_an_override_on_a_deleted_camper_stays_out_of_the_history(self):
        registration = self.started()
        camper = models.Camper.objects.create(
            registration=registration, attributes={'first_name': 'Gone'})
        models.PricingOverride.objects.create(
            registration=registration, camper=camper, var='tuition', amount=Decimal('1.00'),
            reason='Why not')
        camper.soft_delete()
        self.complete_by_admin(registration)
        self.assertFalse(self.logged(registration).filter(
            content_type__model='pricingoverride').exists())

    def test_an_override_on_the_registration_itself_is_logged_at_completion(self):
        registration = self.started()
        models.PricingOverride.objects.create(
            registration=registration, var='donation', amount=Decimal('1.00'), reason='Why not')
        self.complete_by_admin(registration)
        self.assertTrue(self.logged(registration).filter(
            content_type__model='pricingoverride').exists())

    def test_a_save_that_leaves_completed_unsaved_doesnt_start_the_history(self):
        registration = self.started()
        registration.completed = True
        registration.save_without_recalc(update_fields=['updated_at'])
        self.assertFalse(self.logged(registration).exists())

    def test_everything_after_completion_is_logged_as_usual(self):
        registration = self.started()
        self.complete_by_admin(registration)
        registration.refresh_from_db()
        camper = registration.campers.get()
        payment = models.Payment.objects.create(registration=registration, amount=Decimal('5.00'))
        camper.attributes = {'first_name': 'Alex', 'last_name': 'Gamma'}
        camper.save()
        registration.soft_delete()

        self.assertEqual(entries_for(payment).get().action, LogEntry.Action.CREATE)
        self.assertTrue(entries_for(camper).filter(action=LogEntry.Action.UPDATE).exists())
        self.assertTrue(entries_for(registration).filter(changes__has_key='deleted_at').exists())

    def test_a_completed_registrations_delete_is_logged(self):
        registration = self.started()
        self.complete_by_admin(registration)
        registration.refresh_from_db()
        registration_id = registration.id
        registration.delete()
        deleted = LogEntry.objects.filter(
            additional_data__registration=registration_id, action=LogEntry.Action.DELETE)
        self.assertEqual({entry.content_type.model for entry in deleted},
                         {'registration', 'camper'})

    def test_a_hard_delete_logs_every_record_even_with_a_refund(self):
        # A refund's link to its payment leaves Django unable to order the delete,
        # so the registration's row can go before those of the records under it.
        registration = self.started()
        self.complete_by_admin(registration)
        registration.refresh_from_db()
        payment = models.Payment.objects.create(registration=registration, amount=Decimal('5.00'))
        models.Payment.objects.create(
            registration=registration, invoice=payment.invoice, amount=Decimal('-5.00'),
            refund_of=payment)
        registration_id = registration.id
        registration.delete()
        deleted = LogEntry.objects.filter(
            additional_data__registration=registration_id, action=LogEntry.Action.DELETE)
        self.assertEqual({entry.content_type.model for entry in deleted},
                         {'registration', 'camper', 'invoice', 'payment'})

    def test_a_delete_nothing_logged_credits_no_one(self):
        registration = self.started()
        self.complete_by_admin(registration)
        self.client.force_authenticate(self.registrar)
        response = self.client.patch(
            f'/api/registrations/{registration.id}/', {'completed': False}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.client.force_authenticate(make_user(roles.ADMIN, 'boss'))
        self.assertEqual(
            self.client.delete(f'/api/registrations/{registration.id}/').status_code, 204)

        response = self.client.get(f'/api/registrations/deleted/?event={self.made.event.id}')
        row = next(row for row in response.data if row['id'] == registration.id)
        self.assertIsNone(row['deleted_by'])

    def test_a_logged_delete_is_credited(self):
        registration = self.started()
        self.complete_by_admin(registration)
        self.assertEqual(
            self.client.delete(f'/api/registrations/{registration.id}/').status_code, 204)
        response = self.client.get(f'/api/registrations/deleted/?event={self.made.event.id}')
        row = next(row for row in response.data if row['id'] == registration.id)
        self.assertEqual(row['deleted_by']['username'], 'reggie')

    def test_one_made_completed_is_logged_from_the_start(self):
        registration = models.Registration.objects.create(
            event=self.made.event, registrant_email='new@example.com', completed=True)
        self.assertEqual(entries_for(registration).first().action, LogEntry.Action.CREATE)

    def test_nothing_else_is_held_back(self):
        report = models.Report.objects.create(event=self.made.event, title='Roster', template='x')
        self.assertTrue(entries_for(report).exists())


class IncompleteAccessTests(APITestCase):
    def test_every_role_can_see_incomplete_registrations(self):
        made = create_template_event()
        started = models.Registration.objects.create(
            event=made.event, registrant_email='new@example.com')
        for role in (roles.REGISTRAR, roles.ADMIN, roles.REPORTER):
            with self.subTest(role=role):
                self.client.force_authenticate(make_user(role, f'user-{role}'))
                response = self.client.get(f'/api/registrations/?event={made.event.id}&completed=0')
                self.assertEqual(response.status_code, 200, response.data)
                self.assertIn(started.id, [row['id'] for row in response.data])


class EntriesBeforeCompletionMigrationTests(APITestCase):
    '''Migration 0088 deletes what the log holds from before completion.'''

    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()
        cls.registration_type = entries_for(cls.made.r1).first().content_type

    def migrate(self):
        migration = import_module('camphoric.migrations.0088_audit_starts_at_completion')
        migration.delete_entries_before_completion(apps, None)

    def registration(self, completed=False):
        registration = models.Registration.objects.create(
            event=self.made.event, registrant_email='new@example.com')
        # With an update, so nothing is logged for it; each test says what was.
        models.Registration.all_objects.filter(id=registration.id).update(completed=completed)
        return registration

    def entry(self, registration_id, changes=None, content_type=None, **tags):
        return LogEntry.objects.create(
            content_type=content_type or self.registration_type, object_pk=str(registration_id),
            object_id=registration_id, object_repr='r', action=LogEntry.Action.UPDATE,
            changes=changes or {'attributes': ['{}', '{"comments": "Hi"}']},
            additional_data={'registration': registration_id, **tags})

    def remaining(self, *entries):
        return [entry for entry in entries if LogEntry.objects.filter(id=entry.id).exists()]

    def test_a_registration_not_completed_loses_everything(self):
        incomplete = self.registration()
        camper_type = entries_for(self.made.c1).first().content_type
        entries = (self.entry(incomplete.id), self.entry(incomplete.id, content_type=camper_type))
        self.migrate()
        self.assertEqual(self.remaining(*entries), [])

    def test_a_deleted_incomplete_registration_loses_everything(self):
        deleted = self.registration()
        entry = self.entry(deleted.id)
        deleted.soft_delete()
        self.migrate()
        self.assertEqual(self.remaining(entry), [])

    def test_one_the_clean_up_deleted_loses_everything(self):
        abandoned = self.registration()
        entries = (self.entry(abandoned.id, {'completed': ['None', 'False']}),
                   self.entry(abandoned.id, {'completed': ['False', 'None']}))
        abandoned_id = abandoned.id
        models.Registration.all_objects.filter(id=abandoned.id).update(
            updated_at=timezone.now() - datetime.timedelta(days=31))
        cleanup.delete_abandoned_registrations()
        self.assertFalse(models.Registration.all_objects.filter(id=abandoned_id).exists())
        self.migrate()
        self.assertEqual(self.remaining(*entries), [])

    def test_a_completed_registration_keeps_only_what_followed_completion(self):
        completed = self.registration(completed=True)
        before = self.entry(completed.id)
        completion = self.entry(completed.id, {'completed': ['False', 'True']})
        after = self.entry(completed.id)
        self.migrate()
        self.assertEqual(self.remaining(before, completion, after), [completion, after])

    def test_it_counts_from_the_first_completion(self):
        completed = self.registration(completed=True)
        first = self.entry(completed.id, {'completed': ['False', 'True']})
        between = self.entry(completed.id, {'completed': ['True', 'False']})
        second = self.entry(completed.id, {'completed': ['False', 'True']})
        self.migrate()
        self.assertEqual(self.remaining(first, between, second), [first, between, second])

    def test_a_completed_one_since_deleted_keeps_what_followed_completion(self):
        before = self.entry(987654)
        completion = self.entry(987654, {'completed': ['False', 'True']})
        deleted = self.entry(987654, {'completed': ['True', 'None']})
        self.migrate()
        self.assertEqual(self.remaining(before, completion, deleted), [completion, deleted])

    def test_a_deleted_one_only_its_last_values_show_was_completed_keeps_everything(self):
        edit = self.entry(987654)
        deleted = self.entry(987654, {'completed': ['True', 'None']})
        self.migrate()
        self.assertEqual(self.remaining(edit, deleted), [edit, deleted])

    def test_one_completed_before_the_log_began_keeps_everything(self):
        completed = self.registration(completed=True)
        edit = self.entry(completed.id)
        self.migrate()
        self.assertEqual(self.remaining(edit), [edit])

    def test_entries_for_no_registration_are_left_alone(self):
        report = models.Report.objects.create(event=self.made.event, title='Roster', template='x')
        untagged = entries_for(report).get()
        no_registration = self.entry(self.made.r1.id, registration=None)
        self.migrate()
        self.assertEqual(self.remaining(untagged, no_registration), [untagged, no_registration])


class UserHistoryTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()
        cls.registrar = make_user(roles.REGISTRAR, 'reggie')
        cls.admin = make_user(roles.ADMIN, 'boss')

    def edit_as(self, user, comments):
        self.client.force_authenticate(user)
        response = self.client.patch(
            f'/api/registrations/{self.made.r1.id}/',
            {'attributes': {**self.made.r1.attributes, 'comments': comments}}, format='json')
        self.assertEqual(response.status_code, 200, response.data)

    def history(self, user, query=''):
        self.client.force_authenticate(self.admin)
        response = self.client.get(f'/api/users/{user.id}/history/{query}')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_lists_what_the_user_changed_newest_first(self):
        self.edit_as(self.registrar, 'First')
        self.edit_as(self.admin, 'Not reggie')
        self.edit_as(self.registrar, 'Second')

        page = self.history(self.registrar)
        entries = page['results']
        self.assertEqual({e['actor']['username'] for e in entries}, {'reggie'})
        comments = [e['changes']['attributes'][1]['comments'] for e in entries
                    if e['object']['type'] == 'registration' and 'attributes' in e['changes']]
        self.assertEqual(comments, ['Second', 'First'])
        timestamps = [e['timestamp'] for e in entries]
        self.assertEqual(timestamps, sorted(timestamps, reverse=True))

    def test_pages_by_fifty(self):
        LogEntry.objects.bulk_create([
            LogEntry(actor=self.registrar, content_type=entries_for(self.made.r1)[0].content_type,
                     object_id=self.made.r1.id, object_repr='r1', action=LogEntry.Action.UPDATE,
                     changes={})
            for _ in range(55)])
        first = self.history(self.registrar)
        self.assertEqual(first['count'], 55)
        self.assertEqual(len(first['results']), 50)
        self.assertIsNotNone(first['next'])
        self.assertEqual(len(self.history(self.registrar, '?page=2')['results']), 5)

    def test_someone_who_changed_nothing_has_an_empty_history(self):
        self.assertEqual(self.history(self.registrar)['results'], [])

    def test_hidden_from_everyone_but_admins(self):
        path = f'/api/users/{self.registrar.id}/history/'
        self.assertEqual(self.client.get(path).status_code, 404)
        for role in (roles.REGISTRAR, roles.REPORTER):
            with self.subTest(role=role):
                self.client.force_authenticate(make_user(role, f'user-{role}'))
                self.assertEqual(self.client.get(path).status_code, 404)

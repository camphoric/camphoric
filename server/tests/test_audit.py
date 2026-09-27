'''
The audit log of admin changes (camphoric.audit, SPEC DR-54): who is credited,
what's recorded and left out, and the registration and camper histories.
'''

from decimal import Decimal

from auditlog.models import LogEntry
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from camphoric import models, roles
from tests.factories import create_template_event, make_user


def entries_for(instance):
    return LogEntry.objects.get_for_object(instance).order_by('id')


class CreditTests(APITestCase):
    def setUp(self):
        self.made = create_template_event()
        self.registrar = make_user(roles.REGISTRAR, 'reggie')

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
    def setUp(self):
        self.made = create_template_event()

    def test_paypal_replies_are_left_out_and_pricing_kept(self):
        registration = self.made.r1
        registration.paypal_response = {'payer': {'name': 'Pat'}}
        registration.attributes = {**registration.attributes, 'campership_donation': 75}
        registration.save()

        changed = set().union(*(entry.changes for entry in entries_for(registration)))
        self.assertNotIn('paypal_response', changed)
        self.assertIn('server_pricing_results', changed)
        self.assertNotIn('updated_at', changed)

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
    def setUp(self):
        self.made = create_template_event()
        self.registrar = make_user(roles.REGISTRAR, 'reggie')

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
        self.assertEqual(types, {'registration', 'camper', 'payment', 'customcharge'})
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

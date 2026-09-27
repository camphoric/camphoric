'''
What a delete takes with it (camphoric.deletes, SPEC DR-54): the delete rules,
and the delete preview that shows them — which must match what the delete does.
'''

import datetime
from decimal import Decimal

from auditlog.models import LogEntry
from django.db.models import ProtectedError
from rest_framework.test import APITestCase

from camphoric import models, roles
from tests.factories import create_template_event, make_user


class DeleteTestCase(APITestCase):
    def setUp(self):
        self.made = create_template_event()
        self.registrar = make_user(roles.REGISTRAR, 'reggie')
        self.admin = make_user(roles.ADMIN, 'boss')
        self.client.force_authenticate(self.registrar)

    def preview(self, path):
        response = self.client.get(f'{path}delete-preview/')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    @staticmethod
    def entry(entries, type_):
        return next(entry for entry in entries if entry['type'] == type_)


class LodgingTests(DeleteTestCase):
    def test_deleting_a_lodging_unassigns_its_campers(self):
        made = self.made
        path = f'/api/lodgings/{made.cabins.id}/'

        preview = self.preview(path)
        self.assertTrue(preview['can_delete'])
        self.assertEqual(self.entry(preview['deletes'], 'lodging')['items'], ['Cabin A', 'Cabin B'])
        unassigned = next(c for c in preview['changes']
                          if c['description'] == 'will be unassigned from their lodging')
        self.assertEqual(unassigned['items'], ['Pat Alpha', 'Sam Alpha', 'Drew Gamma'])
        requested = next(c for c in preview['changes'] if 'asked for' in c['description'])
        self.assertEqual(requested['items'], ['Pat Alpha'])
        # A preview changes nothing.
        made.c1.refresh_from_db()
        self.assertEqual(made.c1.lodging, made.cabin_a)

        self.assertEqual(self.client.delete(path).status_code, 204)
        for camper in (made.c1, made.c2, made.c4):
            camper.refresh_from_db()
            self.assertIsNone(camper.lodging)
            self.assertIsNone(camper.stay)
        self.assertIsNone(made.c1.lodging_requested)
        self.assertFalse(models.Lodging.objects.filter(id__in=[made.cabin_a.id, made.cabin_b.id]))
        # Lee, in a tent, keeps their place.
        made.c3.refresh_from_db()
        self.assertEqual(made.c3.lodging, made.tent_1)

    def test_the_unassignments_are_logged(self):
        self.client.delete(f'/api/lodgings/{self.made.cabin_a.id}/')
        entry = LogEntry.objects.get_for_object(self.made.c1).filter(
            action=LogEntry.Action.UPDATE, changes__has_key='lodging').get()
        self.assertEqual(entry.actor, self.registrar)
        self.assertIn('stay', entry.changes)


class RegistrationTypeTests(DeleteTestCase):
    def test_its_registrations_stay_and_its_invitations_go(self):
        made = self.made
        template = made.staff.invitation_template
        path = f'/api/registrationtypes/{made.staff.id}/'

        preview = self.preview(path)
        self.assertEqual(self.entry(preview['deletes'], 'invitation')['count'], 2)
        self.assertEqual(self.entry(preview['deletes'], 'emailtemplate')['items'],
                         [str(template)])
        kept = self.entry(preview['changes'], 'registration')
        self.assertEqual((kept['items'], kept['description']),
                         (['lee@example.com'], 'will have no registration type'))

        self.assertEqual(self.client.delete(path).status_code, 204)
        made.r2.refresh_from_db()
        self.assertIsNone(made.r2.registration_type)
        self.assertFalse(models.Invitation.objects.filter(registration_type_id=made.staff.id))
        self.assertFalse(models.EmailTemplate.objects.filter(id=template.id))


class DepositTests(DeleteTestCase):
    def test_its_payments_stay(self):
        deposit = models.Deposit.objects.create(
            event=self.made.event, amount=Decimal('100.00'),
            deposited_on=datetime.date(2026, 10, 5))
        payment = models.Payment.objects.filter(registration=self.made.r1).get()
        payment.deposit = deposit
        payment.save()
        path = f'/api/deposits/{deposit.id}/'

        change = self.entry(self.preview(path)['changes'], 'payment')
        self.assertEqual(change['description'], 'will no longer be part of a deposit')

        self.assertEqual(self.client.delete(path).status_code, 204)
        payment.refresh_from_db()
        self.assertIsNone(payment.deposit)


class CustomChargeTypeTests(DeleteTestCase):
    def test_one_campers_have_cant_be_deleted(self):
        path = f'/api/customchargetypes/{self.made.linens.id}/'
        preview = self.preview(path)
        self.assertFalse(preview['can_delete'])
        self.assertEqual(preview['blocked_by'], [{
            'detail': 'Campers still have this charge.', 'count': 1, 'items': ['Linens $25.00']}])

        response = self.client.delete(path)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['detail'], 'Campers still have this charge.')

    def test_an_unused_one_can(self):
        unused = models.CustomChargeType.objects.create(
            event=self.made.event, name='tshirt', label='T-shirt')
        response = self.client.delete(f'/api/customchargetypes/{unused.id}/')
        self.assertEqual(response.status_code, 204)


class EventTests(DeleteTestCase):
    def test_registrars_cant_delete_events(self):
        path = f'/api/events/{self.made.event.id}/'
        self.assertEqual(self.client.get(f'{path}delete-preview/').status_code, 403)
        self.assertEqual(self.client.delete(path).status_code, 403)

    def test_not_once_anyone_has_registered(self):
        self.client.force_authenticate(self.admin)
        path = f'/api/events/{self.made.event.id}/'
        preview = self.preview(path)
        self.assertFalse(preview['can_delete'])
        self.assertEqual(preview['blocked_by'][0]['count'], 3)
        self.assertEqual(self.client.delete(path).status_code, 409)

    def test_an_admin_can_delete_one_without_registrations(self):
        self.client.force_authenticate(self.admin)
        event = models.Event.objects.create(organization=self.made.organization, name='Empty')
        models.Report.objects.create(event=event, title='Campers', template='x')
        path = f'/api/events/{event.id}/'
        self.assertEqual(self.entry(self.preview(path)['deletes'], 'report')['count'], 1)
        self.assertEqual(self.client.delete(path).status_code, 204)
        self.assertFalse(models.Event.objects.filter(id=event.id))


class OrganizationTests(DeleteTestCase):
    def test_one_with_events_cant_be_deleted_anywhere(self):
        self.client.force_authenticate(self.admin)
        preview = self.preview(f'/api/organizations/{self.made.organization.id}/')
        self.assertEqual([b['detail'] for b in preview['blocked_by']], ['It still has events.'])
        with self.assertRaises(ProtectedError):
            self.made.organization.delete()

    def test_only_admins_see_the_preview(self):
        path = f'/api/organizations/{self.made.organization.id}/delete-preview/'
        self.assertEqual(self.client.get(path).status_code, 403)


class EmailAccountTests(DeleteTestCase):
    def test_one_an_event_uses_says_so(self):
        account = models.EmailAccount.objects.create(
            organization=self.made.organization, name='Camp Gmail', host='smtp.example.com',
            port=587, username='camp@example.com', password='secret')
        self.made.event.email_account = account
        self.made.event.save()
        preview = self.preview(f'/api/emailaccounts/{account.id}/')
        self.assertEqual(preview['blocked_by'][0]['items'], ['Test Camp'])
        self.assertIn('Choose another account', preview['blocked_by'][0]['detail'])


class PreviewTests(DeleteTestCase):
    def test_email_records_are_summarized(self):
        template = models.EmailTemplate.objects.create(
            event=self.made.event, purpose='group', name='News', subject='News', body='Hi')
        models.EmailMessage.objects.create(
            event=self.made.event, kind=models.EmailMessageKind.BULK, template=template,
            to='pat@example.com', from_email='camp@example.com', subject='News', text='Hi')
        change = self.entry(self.preview(f'/api/emailtemplates/{template.id}/')['changes'],
                            'emailmessage')
        self.assertEqual((change['count'], change['items'], change['description']),
                         (1, [], 'stay in the email history'))

    def test_confirmation_emails_cant_be_deleted(self):
        template = self.made.event.confirmation_template
        preview = self.preview(f'/api/emailtemplates/{template.id}/')
        self.assertFalse(preview['can_delete'])

    def test_reporters_and_strangers_get_no_preview(self):
        path = f'/api/reports/{models.Report.objects.create(event=self.made.event, title="R").id}/'
        self.client.force_authenticate(make_user(roles.REPORTER, 'rita'))
        self.assertEqual(self.client.get(f'{path}delete-preview/').status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f'{path}delete-preview/').status_code, 401)

    def test_you_cant_delete_yourself(self):
        self.client.force_authenticate(self.admin)
        preview = self.preview(f'/api/users/{self.admin.id}/')
        self.assertEqual([b['detail'] for b in preview['blocked_by']],
                         ['You can\'t delete your own account.'])
        self.assertEqual(self.client.delete(f'/api/users/{self.admin.id}/').status_code, 409)

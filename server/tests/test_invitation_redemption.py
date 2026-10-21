'''
One invitation, one completed registration (#803): several registrations may
be started with the same invitation, but only the first to be completed
redeems it; completing another is refused with `invitation_redeemed`.
'''

from importlib import import_module
import threading
import time
from unittest import mock

from django.apps import apps

from django.db import connection
from rest_framework.test import APIClient, APITestCase, APITransactionTestCase

from camphoric import confirmations, invoices, live, models, roles, views
from tests.factories import make_user

REDEEMED = {
    'detail': 'Sorry, that invitation code has already been redeemed by another registration.',
    'code': 'invitation_redeemed',
}


class Invited:
    def setUp(self):
        super().setUp()
        organization = models.Organization.objects.create(name='Camp Org')
        self.event = models.Event.objects.create(
            organization=organization, name='Camp', pricing={'adult': 100},
            registration_pricing_logic=[],
            camper_pricing_logic=[{'label': 'Total', 'var': 'total', 'exp': 100}],
            paypal_client_id='client', confirmation_email_from='reg@camp.org')
        self.staff = models.RegistrationType.objects.create(
            event=self.event, name='staff', label='Staff')
        self.invitation = models.Invitation.objects.create(
            registration_type=self.staff, recipient_email='lee@example.com')

    def post(self, body, status=200, client=None):
        response = (client or self.client).post(
            f'/api/events/{self.event.id}/register', body, format='json')
        self.assertEqual(response.status_code, status, response.data)
        return response

    def start(self):
        '''Start a registration with the invitation; its uuid.'''
        return self.post({
            'step': 'registration',
            'formData': {'registrant_email': 'lee@example.com', 'campers': [{'first_name': 'Lee'}]},
            'pricingResults': {},
            'invitation': {
                'recipient_email': self.invitation.recipient_email,
                'invitation_code': self.invitation.invitation_code,
            },
        }).data['registrationUUID']

    def pay_by_check(self, uuid, status=200, client=None):
        return self.post({'step': 'payment', 'registrationUUID': uuid, 'paymentType': 'Check'},
                         status, client)

    def registration(self, uuid):
        return models.Registration.all_objects.get(uuid=uuid)


class InvitationRedemptionTests(Invited, APITestCase):
    def test_each_registration_records_the_invitation_it_was_started_with(self):
        first, second = self.start(), self.start()
        self.assertEqual(self.registration(first).started_with_invitation, self.invitation)
        self.assertEqual(self.registration(second).started_with_invitation, self.invitation)

    def test_only_the_first_completed_redeems_it(self):
        first, second = self.start(), self.start()
        self.pay_by_check(second)
        response = self.pay_by_check(first, status=409)
        self.assertEqual(response.data, REDEEMED)

        self.assertFalse(self.registration(first).completed)
        self.assertFalse(models.Invoice.objects.filter(registration__uuid=first).exists())
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.registration, self.registration(second))

    def test_one_started_earlier_takes_the_invitation_back_when_completed_first(self):
        # Starting the second pointed the invitation at it.
        first, second = self.start(), self.start()
        self.pay_by_check(first)
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.registration, self.registration(first))

        self.assertEqual(self.pay_by_check(second, status=409).data, REDEEMED)
        self.assertFalse(self.registration(second).completed)

    def test_one_the_invitation_no_longer_links_to_still_redeems_it(self):
        # As a registration started before #803 was fixed could have left it.
        first, second = self.start(), self.start()
        self.pay_by_check(first)
        models.Invitation.objects.filter(id=self.invitation.id).update(
            registration=self.registration(second))
        self.assertEqual(self.pay_by_check(second, status=409).data, REDEEMED)

        page = self.client.get(
            f'/api/events/{self.event.id}/register',
            {'email': self.invitation.recipient_email, 'code': self.invitation.invitation_code})
        self.assertEqual(page.data['invitationError'],
                         'Sorry, that invitation code has already been redeemed')

    def test_an_invitation_deleted_while_starting_is_not_found(self):
        find_invitation = views.RegisterView.find_invitation

        def found_then_deleted(view, request, event):
            invitation = find_invitation(request, event)
            models.Invitation.objects.filter(pk=invitation.pk).delete()
            return invitation

        with mock.patch.object(views.RegisterView, 'find_invitation', found_then_deleted):
            response = self.post({
                'step': 'registration',
                'formData': {'registrant_email': 'lee@example.com', 'campers': [{}]},
                'pricingResults': {},
                'invitation': {'recipient_email': self.invitation.recipient_email,
                               'invitation_code': self.invitation.invitation_code},
            }, status=400)
        self.assertIn('couldn\'t find an invitation', response.data['detail'])
        self.assertFalse(models.Registration.all_objects.exists())

    def test_the_paypal_button_is_refused_too(self):
        first, second = self.start(), self.start()
        self.pay_by_check(first)
        response = self.post({'step': 'paypal-order', 'registrationUUID': second,
                              'paymentType': 'PayPal'}, status=409)
        self.assertEqual(response.data, REDEEMED)
        self.assertFalse(self.registration(second).completed)
        self.assertFalse(models.Invoice.objects.filter(registration__uuid=second).exists())

    def test_the_registration_that_redeemed_it_can_pay_again(self):
        # A retry, or a lost reply: it's already completed.
        first, _ = self.start(), self.start()
        self.pay_by_check(first)
        self.pay_by_check(first)

    def test_a_redeeming_registration_since_deleted_still_counts(self):
        first, second = self.start(), self.start()
        self.pay_by_check(first)
        self.registration(first).soft_delete()
        self.assertEqual(self.pay_by_check(second, status=409).data, REDEEMED)

    def test_a_deleted_invitation_no_longer_stops_it(self):
        first, second = self.start(), self.start()
        self.pay_by_check(first)
        self.invitation.delete()
        self.pay_by_check(second)
        self.assertIsNone(self.registration(second).started_with_invitation)


class RedeemedStatusTests(Invited, APITestCase):
    '''The admin API says an invitation is redeemed only once a registration completes with it.'''

    def setUp(self):
        super().setUp()
        self.admin = APIClient()
        self.admin.force_authenticate(make_user(roles.REGISTRAR, 'reggie'))

    def listed(self):
        response = self.admin.get(f'/api/invitations/{self.invitation.id}/')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_a_started_registration_does_not_redeem_it(self):
        started = self.start()
        listed = self.listed()
        self.assertEqual(listed['registration'], self.registration(started).id)
        self.assertFalse(listed['redeemed'])

    def test_a_completed_one_does(self):
        self.assertFalse(self.listed()['redeemed'])
        self.pay_by_check(self.start())
        self.assertTrue(self.listed()['redeemed'])

    def test_a_started_registration_deleted_is_not_a_deleted_redemption(self):
        started = self.start()
        self.registration(started).soft_delete()
        listed = self.listed()
        self.assertFalse(listed['redeemed'])
        self.assertFalse(listed['registration_deleted'])

    def test_the_list_works_it_out_without_a_query_per_invitation(self):
        self.pay_by_check(self.start())
        models.Invitation.objects.create(
            registration_type=self.staff, recipient_email='kim@example.com')
        with mock.patch.object(models.Invitation, 'is_redeemed', side_effect=AssertionError):
            response = self.admin.get('/api/invitations/', {'event': self.event.id})
        self.assertEqual(response.status_code, 200, response.data)
        redeemed = {i['recipient_email']: i['redeemed'] for i in response.data}
        self.assertEqual(redeemed, {'lee@example.com': True, 'kim@example.com': False})

    def test_completing_tells_the_invitations_list(self):
        # The invitation already links to the registration, so nothing saves it.
        started = self.start()
        with mock.patch.object(live, 'notify') as notify, self.captureOnCommitCallbacks(
                execute=True):
            self.pay_by_check(started)
        notices = {(n['model'], n['id']) for (n,), _ in notify.call_args_list
                   if n['type'] == 'changed'}
        self.assertIn(('invitation', self.invitation.id), notices)

    def test_a_completed_registration_deleted_still_redeems_it(self):
        completed = self.start()
        self.pay_by_check(completed)
        self.registration(completed).soft_delete()
        listed = self.listed()
        self.assertTrue(listed['redeemed'])
        self.assertTrue(listed['registration_deleted'])


class RecordingStartedInvitationsTests(Invited, APITestCase):
    '''Migration 0087 ties registrations started before it to their invitations.'''

    def migrate(self):
        migration = import_module('camphoric.migrations.0087_registration_started_with_invitation')
        models.Registration.all_objects.update(started_with_invitation=None)
        migration.record_started_invitations(apps, None)

    def registration(self, **fields):
        return models.Registration.objects.create(
            event=self.event, registration_type=self.staff, **fields)

    def test_the_registration_an_invitation_links_to_was_started_with_it(self):
        started = self.registration(registrant_email='lee@example.com')
        self.invitation.registration = started
        self.invitation.save()
        self.migrate()
        started.refresh_from_db()
        self.assertEqual(started.started_with_invitation, self.invitation)

    def test_one_completed_before_another_was_started_redeems_it(self):
        # Start A, start B (the invitation moved to B), complete A.
        completed = self.registration(registrant_email='Lee@Example.com', completed=True)
        started = self.registration(registrant_email='lee@example.com')
        self.invitation.registration = started
        self.invitation.save()
        self.migrate()

        completed.refresh_from_db()
        self.invitation.refresh_from_db()
        self.assertEqual(completed.started_with_invitation, self.invitation)
        self.assertEqual(self.invitation.registration, completed)
        self.assertTrue(self.invitation.is_redeemed())

    def test_it_takes_no_guess_between_two(self):
        for _ in range(2):
            self.registration(registrant_email='lee@example.com', completed=True)
        started = self.registration(registrant_email='lee@example.com')
        self.invitation.registration = started
        self.invitation.save()
        self.migrate()
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.registration, started)
        self.assertFalse(self.invitation.is_redeemed())

    def test_one_another_invitation_links_to_is_left_to_it(self):
        other = models.Invitation.objects.create(
            registration_type=self.staff, recipient_email='lee@example.com')
        other.registration = self.registration(registrant_email='lee@example.com', completed=True)
        other.save()
        started = self.registration(registrant_email='lee@example.com')
        self.invitation.registration = started
        self.invitation.save()
        self.migrate()
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.registration, started)


class SimultaneousRedemptionTests(Invited, APITransactionTestCase):
    '''
    What happens while a registration started with the invitation is being
    completed: whatever else would complete, start or delete with the same
    invitation waits for it, then sees what it did. Real connections, so not
    inside a test's transaction.
    '''

    def while_completing(self, uuid, holder, name, request):
        '''
        Pay `uuid` by check, held at `holder.name` (which the payment step calls
        in its transaction) while `request` is sent, and check that `request`
        waits for it. Returns the payment's response and `request`'s.
        '''
        held, release = threading.Event(), threading.Event()
        original = getattr(holder, name)
        results = {}

        def hold(*args, **kwargs):
            if not held.is_set():
                held.set()
                release.wait(5)
            return original(*args, **kwargs)

        def run(key, send):
            try:
                results[key] = send()
            finally:
                connection.close()

        def pay():
            return APIClient().post(
                f'/api/events/{self.event.id}/register',
                {'step': 'payment', 'registrationUUID': uuid, 'paymentType': 'Check'},
                format='json')

        with mock.patch.object(holder, name, side_effect=hold):
            paying = threading.Thread(target=run, args=('paying', pay))
            paying.start()
            try:
                self.assertTrue(held.wait(5))
                other = threading.Thread(target=run, args=('other', request))
                other.start()
                time.sleep(0.3)  # long enough to reach the lock it waits on
                self.assertNotIn('other', results, 'It went ahead without waiting.')
            finally:
                release.set()
                paying.join(10)
            other.join(10)
        return results['paying'], results['other']

    def test_a_second_completing_waits_for_the_first_and_is_refused(self):
        first, second = self.start(), self.start()

        def pay_second():
            return APIClient().post(
                f'/api/events/{self.event.id}/register',
                {'step': 'payment', 'registrationUUID': second, 'paymentType': 'Check'},
                format='json')

        paid, refused = self.while_completing(
            first, confirmations, 'send_confirmation', pay_second)
        self.assertEqual(paid.status_code, 200)
        self.assertEqual((refused.status_code, refused.data), (409, REDEEMED))
        self.assertTrue(self.registration(first).completed)
        self.assertFalse(self.registration(second).completed)

    def test_one_started_meanwhile_is_refused_and_leaves_the_invitation_redeemed(self):
        first = self.start()

        def start_another():
            return APIClient().post(f'/api/events/{self.event.id}/register', {
                'step': 'registration',
                'formData': {'registrant_email': 'lee@example.com', 'campers': [{}]},
                'pricingResults': {},
                'invitation': {
                    'recipient_email': self.invitation.recipient_email,
                    'invitation_code': self.invitation.invitation_code,
                },
            }, format='json')

        paid, refused = self.while_completing(
            first, confirmations, 'send_confirmation', start_another)
        self.assertEqual(paid.status_code, 200)
        self.assertEqual((refused.status_code, refused.data),
                         (400, {'detail': 'Sorry, that invitation code has already been redeemed'}))
        self.assertEqual(models.Registration.all_objects.count(), 1)
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.registration, self.registration(first))

    def test_deleting_the_invitation_meanwhile_waits_for_it(self):
        # Completing takes the registration, then the invitation; deleting the
        # invitation clears it from the registration, so it takes them in that
        # order too, rather than deadlocking.
        first = self.start()
        admin = make_user(roles.ADMIN, 'boss')

        def delete_invitation():
            client = APIClient()
            client.force_authenticate(admin)
            return client.delete(f'/api/invitations/{self.invitation.id}/')

        paid, deleted = self.while_completing(
            first, invoices, 'prepare_registration_invoice', delete_invitation)
        self.assertEqual(paid.status_code, 200)
        self.assertEqual(deleted.status_code, 204)
        self.assertTrue(self.registration(first).completed)
        self.assertIsNone(self.registration(first).started_with_invitation)
        self.assertFalse(models.Invitation.objects.exists())

'''
Registering outside the registration dates (issue #296): the public
registration step is refused while the event isn't open, unless it carries a
valid invitation for this event — special registration types can still
register after registration closes (or before it opens). A registration
already accepted can always go on to pay.
'''

import datetime

from rest_framework.test import APITestCase

from camphoric import models

TODAY = datetime.date.today()
CLOSED = {'registration_end': TODAY - datetime.timedelta(days=1)}
NOT_YET = {'registration_start': TODAY + datetime.timedelta(days=1)}


class RegistrationDatesTests(APITestCase):
    def setUp(self):
        self.organization = models.Organization.objects.create(name='Camp Org')
        self.event = self.make_event('Camp')
        self.staff = models.RegistrationType.objects.create(
            event=self.event, name='staff', label='Staff')
        self.invitation = models.Invitation.objects.create(
            registration_type=self.staff, recipient_email='lee@example.com',
            recipient_name='Lee')

    def make_event(self, name, **dates):
        return models.Event.objects.create(
            organization=self.organization, name=name, pricing={'adult': 100},
            registration_pricing_logic=[],
            camper_pricing_logic=[{'label': 'Total', 'var': 'total', 'exp': 100}],
            confirmation_email_from='reg@camp.org', **dates)

    def set_dates(self, **dates):
        models.Event.objects.filter(id=self.event.id).update(**dates)

    def register(self, invitation=None, status=200):
        body = {
            'formData': {'registrant_email': 'lee@example.com', 'campers': [{'first_name': 'Lee'}]},
            'pricingResults': {},
        }
        if invitation is not None:
            body['invitation'] = {
                'recipient_email': invitation.recipient_email,
                'invitation_code': invitation.invitation_code,
            }
        response = self.client.post(f'/api/events/{self.event.id}/register', body, format='json')
        self.assertEqual(response.status_code, status, response.data)
        return response

    def test_an_open_event_takes_anyone(self):
        self.register()
        self.assertEqual(models.Registration.objects.count(), 1)

    def test_a_closed_event_refuses_a_registration_without_an_invitation(self):
        for dates in (CLOSED, NOT_YET):
            with self.subTest(dates=dates):
                self.set_dates(**{'registration_start': None, 'registration_end': None, **dates})
                response = self.register(status=409)
                self.assertEqual(response.data['detail'], 'Registration for this event is closed.')
                self.assertEqual(models.Registration.objects.count(), 0)

    def test_an_invitation_still_gets_in_after_it_closes_or_before_it_opens(self):
        for dates in (CLOSED, NOT_YET):
            with self.subTest(dates=dates):
                models.Registration.objects.all().delete()
                self.set_dates(**{'registration_start': None, 'registration_end': None, **dates})
                self.register(self.invitation)
                registration = models.Registration.objects.get()
                self.assertEqual(registration.registration_type, self.staff)
                self.invitation.refresh_from_db()
                self.assertEqual(self.invitation.registration, registration)

    def test_an_invitation_for_another_event_does_not_get_in(self):
        other = self.make_event('Other camp')
        other_type = models.RegistrationType.objects.create(
            event=other, name='staff', label='Staff')
        elsewhere = models.Invitation.objects.create(
            registration_type=other_type, recipient_email='lee@example.com')
        self.set_dates(**CLOSED)

        response = self.register(elsewhere, status=400)
        self.assertEqual(
            response.data, {'detail': 'Sorry, that invitation is for a different event'})
        self.assertEqual(models.Registration.objects.count(), 0)

        # The registration page says so too.
        page = self.client.get(
            f'/api/events/{self.event.id}/register',
            {'email': elsewhere.recipient_email, 'code': elsewhere.invitation_code})
        self.assertIn('different event', page.data['invitationError'])
        self.assertNotIn('invitation', page.data)

    def test_an_expired_invitation_does_not_get_in(self):
        self.invitation.expiration_time = datetime.datetime.now(datetime.timezone.utc) - \
            datetime.timedelta(days=1)
        self.invitation.save()
        self.set_dates(**CLOSED)
        response = self.register(self.invitation, status=400)
        self.assertEqual(response.data, {'detail': 'Sorry, that invitation code has expired'})

    def test_a_rejected_invitation_says_why(self):
        # Its message is the response's `detail`, which the form shows as is.
        missing = models.Invitation(recipient_email='kim@example.com', invitation_code='nope2345')
        response = self.register(missing, status=400)
        self.assertEqual(response.data, {
            'detail': 'Sorry, we couldn\'t find an invitation for "kim@example.com" '
                      'with code "nope2345"'})

        self.register(self.invitation)
        models.Registration.objects.update(completed=True)
        response = self.register(self.invitation, status=400)
        self.assertEqual(
            response.data, {'detail': 'Sorry, that invitation code has already been redeemed'})

    def test_a_registration_accepted_before_it_closed_can_still_pay(self):
        uuid = self.register().data['registrationUUID']
        self.set_dates(**CLOSED)
        response = self.client.post(f'/api/events/{self.event.id}/register', {
            'registrationUUID': uuid,
            'step': 'payment',
            'paymentType': 'Check',
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(models.Registration.objects.get(uuid=uuid).completed)

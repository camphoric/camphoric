'''
The confirmation email, its problem reports and invitations go through the
outbox (camphoric.mail.outbox, SPEC DR-44).
'''

from django.contrib.auth.models import User
from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from camphoric import models
from tests.factories import set_email

Kind = models.EmailMessageKind
Status = models.EmailMessageStatus

# A worker's queue with no worker running: queued mail stays queued.
NO_WORKER = override_settings(TASKS={'default': {
    'BACKEND': 'django.tasks.backends.dummy.DummyBackend', 'QUEUES': ['email', 'default']}})


class ConfirmationTests(APITestCase):
    def setUp(self):
        self.organization = models.Organization.objects.create(name='Camp Org')
        self.event = models.Event.objects.create(
            organization=self.organization,
            name='Camp',
            pricing={'adult': 100},
            registration_pricing_logic=[],
            camper_pricing_logic=[{'label': 'Total', 'var': 'total', 'exp': 100}],
            confirmation_email_from='reg@camp.org',
        )
        set_email(self.event.confirmation_template, 'Welcome',
                  'Thanks, {{ campers[0].attributes.first_name }}!')

    def start(self, email='pat@example.com'):
        response = self.client.post(f'/api/events/{self.event.id}/register', {
            'formData': {'registrant_email': email, 'campers': [{'first_name': 'Pat'}]},
            'pricingResults': {},
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data['registrationUUID']

    def pay(self, uuid):
        response = self.client.post(f'/api/events/{self.event.id}/register', {
            'registrationUUID': uuid,
            'step': 'payment',
            'paymentType': 'Check',
            'paymentData': {'type': 'Full', 'total': 100},
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return response

    def test_the_confirmation_is_a_recorded_message(self):
        response = self.pay(self.start())
        self.assertFalse(response.data['emailError'])
        registration = models.Registration.objects.get()
        message = models.EmailMessage.objects.get()
        self.assertEqual(message.kind, Kind.CONFIRMATION)
        self.assertEqual(message.registration, registration)
        self.assertEqual(message.event, self.event)
        self.assertEqual(message.to, 'pat@example.com')
        self.assertEqual(message.from_email, 'reg@camp.org')
        self.assertEqual(message.text, 'Thanks, Pat!')
        self.assertEqual(message.status, Status.SENT)
        self.assertEqual(len(mail.outbox), 1)

    def test_repeating_the_payment_step_changes_nothing(self):
        uuid = self.start()
        first = self.pay(uuid)
        second = self.pay(uuid)
        first, second = first.json(), second.json()
        # The balance is a number the first time and the stored string after.
        self.assertEqual(float(first['initialPayment'].pop('balance')),
                         float(second['initialPayment'].pop('balance')))
        self.assertEqual(first, second)
        self.assertEqual(models.EmailMessage.objects.count(), 1)
        self.assertEqual(len(mail.outbox), 1)

    @NO_WORKER
    def test_the_response_does_not_wait_for_delivery(self):
        response = self.pay(self.start())
        self.assertFalse(response.data['emailError'])
        self.assertEqual(models.EmailMessage.objects.get().status, Status.QUEUED)
        self.assertEqual(mail.outbox, [])

    def test_a_dontsend_registrant_is_not_emailed(self):
        response = self.pay(self.start(email='test@dontsend.com'))
        self.assertTrue(response.data['emailError'])
        self.assertEqual(models.EmailMessage.objects.get().status, Status.CANCELLED)
        self.assertEqual(mail.outbox, [])

    def test_problem_reports_are_queued_once(self):
        set_email(self.event.confirmation_template, body='{{ registration.nope.deeper }}')
        self.event.confirmation_page_template = '{{ registration.nope.deeper }}'
        self.event.save()
        uuid = self.start()
        self.assertTrue(self.pay(uuid).data['emailError'])
        self.assertTrue(self.pay(uuid).data['emailError'])

        kinds = sorted(models.EmailMessage.objects.values_list('kind', flat=True))
        self.assertEqual(kinds, [Kind.CONFIRMATION_REPORT, Kind.PAGE_REPORT])
        self.assertEqual({m.to[0] for m in mail.outbox}, {'reg@camp.org'})
        self.assertEqual(len(mail.outbox), 2)


class InvitationTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser('admin', 'admin@example.com', 'pw')
        self.client.force_authenticate(user=self.admin)
        organization = models.Organization.objects.create(name='Camp Org')
        self.event = models.Event.objects.create(
            organization=organization, name='Camp', confirmation_email_from='reg@camp.org')
        registration_type = models.RegistrationType.objects.create(
            event=self.event, name='staff', label='Staff')
        set_email(registration_type.invitation_template, 'Join us',
                  '{{ invitation.register_url }}')
        self.invitation = models.Invitation.objects.create(
            registration_type=registration_type, recipient_name='Lee',
            recipient_email='lee@example.com')

    def send(self):
        return self.client.post(f'/api/invitations/{self.invitation.id}/send')

    def test_sending_queues_a_message(self):
        response = self.send()
        self.assertEqual(response.status_code, 200)
        message = models.EmailMessage.objects.get(id=response.data['messageId'])
        self.assertEqual(message.kind, Kind.INVITATION)
        self.assertEqual(message.invitation, self.invitation)
        self.assertEqual(message.to, '"Lee" <lee@example.com>')
        self.assertEqual(message.created_by, self.admin)
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.sent_time, message.sent_at)

    def test_resending_sends_again(self):
        self.send()
        self.send()
        self.assertEqual(models.EmailMessage.objects.filter(kind=Kind.INVITATION).count(), 2)
        self.assertEqual(len(mail.outbox), 2)

    @NO_WORKER
    def test_sent_time_waits_for_delivery(self):
        response = self.send()
        self.assertEqual(response.data['status'], Status.QUEUED)
        self.invitation.refresh_from_db()
        self.assertIsNone(self.invitation.sent_time)

    def test_a_dontsend_address_is_a_400(self):
        self.invitation.recipient_email = 'lee@dontsend.com'
        self.invitation.save()
        response = self.send()
        self.assertEqual(response.status_code, 400)
        self.assertIn('@dontsend.com', response.data['detail'])
        self.assertEqual(mail.outbox, [])

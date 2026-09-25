'''
Confirmation and invitation emails written in Jinja (SPEC §8.3, §8.4, DR-38).
The Mustache paths are covered, unchanged, by test_views.
'''

from django.contrib.auth.models import User
from django.core import mail
from rest_framework.test import APITestCase

from camphoric import models
from camphoric.templating.checks import check_event_templates

JINJA = models.TemplateEngine.JINJA


class JinjaConfirmationEmailTests(APITestCase):
    def setUp(self):
        self.organization = models.Organization.objects.create(name='Camp Org')
        self.event = models.Event.objects.create(
            organization=self.organization,
            name='Jinja Camp',
            pricing={'adult': 100},
            registration_pricing_logic=[],
            camper_pricing_logic=[
                {'label': 'Tuition', 'var': 'tuition', 'exp': {'var': 'pricing.adult'}},
                {'label': 'Total', 'var': 'total', 'exp': {'var': 'tuition'}},
            ],
            confirmation_email_engine=JINJA,
            confirmation_email_subject='Welcome, {{ campers[0].attributes.first_name }}',
            confirmation_email_template=(
                '# Thanks!\n'
                '{% for camper in campers %}* {{ camper.attributes.first_name }}: '
                '{{ camper.pricing.total | money }}\n{% endfor %}'
                'Paying now: {{ initial_payment.total | money }}'),
            confirmation_email_from='reg@camp.org',
        )

    def register(self, email='pat@example.com', campers=({'first_name': 'Pat'},)):
        response = self.client.post(f'/api/events/{self.event.id}/register', {
            'formData': {'registrant_email': email, 'campers': list(campers)},
            'pricingResults': {},
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.post(f'/api/events/{self.event.id}/register', {
            'registrationUUID': response.data['registrationUUID'],
            'step': 'payment',
            'paymentType': 'Check',
            'paymentData': {'type': 'Full', 'total': 100},
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return response

    def test_renders_subject_and_body_from_the_registration(self):
        # Another registration's campers don't leak into this one's email.
        self.register(email='other@example.com', campers=[{'first_name': 'Other'}])
        mail.outbox.clear()

        response = self.register(campers=[{'first_name': 'Pat'}, {'first_name': 'Sam'}])
        self.assertFalse(response.data['emailError'])
        [message] = mail.outbox
        self.assertEqual(message.to, ['pat@example.com'])
        self.assertEqual(message.from_email, 'reg@camp.org')
        self.assertEqual(message.subject, 'Welcome, Pat')
        self.assertEqual(message.body,
                         '# Thanks!\n* Pat: $100.00\n* Sam: $100.00\nPaying now: $100.00')
        self.assertIn('<h1>Thanks!</h1>', message.alternatives[0][0])

    def test_a_broken_template_reports_to_the_from_address(self):
        self.event.confirmation_email_template = 'Hello\n{{ registration.nope.deeper }}'
        self.event.save()

        response = self.register()

        registration = models.Registration.objects.get()
        self.assertTrue(registration.completed)
        self.assertTrue(response.data['emailError'])
        [report] = mail.outbox  # nothing goes to the registrant
        self.assertEqual(report.to, ['reg@camp.org'])
        self.assertEqual(
            report.subject,
            f'Confirmation email not sent: Jinja Camp, registration #{registration.id}')
        self.assertIn('Registrant: pat@example.com', report.body)
        self.assertIn("ERROR (template, line 2", report.body)
        self.assertIn("registration has no field 'nope'", report.body)
        self.assertIn('{{ registration.nope.deeper }}', report.body)
        self.assertIn(f'registrations?registrationId={registration.id}', report.body)

    def test_without_a_from_address_nothing_is_sent(self):
        self.event.confirmation_email_subject = '{{ campers[0].nope.deeper }}'
        self.event.confirmation_email_from = ''
        self.event.save()
        self.register()
        self.assertEqual(mail.outbox, [])
        self.assertTrue(models.Registration.objects.get().completed)


class JinjaInvitationEmailTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(
            user=User.objects.create_superuser('admin', 'admin@example.com', 'pw'))
        organization = models.Organization.objects.create(name='Camp Org')
        self.event = models.Event.objects.create(
            organization=organization, name='Jinja Camp', confirmation_email_from='reg@camp.org')
        self.registration_type = models.RegistrationType.objects.create(
            event=self.event, name='staff', label='Staff',
            invitation_email_engine=JINJA,
            invitation_email_subject=(
                '{{ registration_type.label }} registration for {{ event.name }}'),
            invitation_email_template=(
                'Hi {{ invitation.recipient_name or invitation.recipient_email }}: '
                '{{ invitation.register_url }}'))
        self.invitation = models.Invitation.objects.create(
            registration_type=self.registration_type, recipient_name='Lee',
            recipient_email='lee@example.com', invitation_code='abcd2345')

    def send(self):
        return self.client.post(f'/api/invitations/{self.invitation.id}/send')

    def test_sends_the_rendered_email(self):
        self.assertEqual(self.send().status_code, 200)
        [message] = mail.outbox
        self.assertEqual(message.subject, 'Staff registration for Jinja Camp')
        self.assertEqual(
            message.body,
            f'Hi Lee: http://testserver/events/{self.event.id}/register'
            '?email=lee@example.com&code=abcd2345')
        self.invitation.refresh_from_db()
        self.assertIsNotNone(self.invitation.sent_time)

    def test_a_broken_template_is_a_400_and_sends_nothing(self):
        self.registration_type.invitation_email_template = '{{ invitation.nope.deeper }}'
        self.registration_type.save()
        response = self.send()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['diagnostics'][0]['message'],
                         "invitation has no field 'nope'")
        self.assertEqual(mail.outbox, [])
        self.invitation.refresh_from_db()
        self.assertIsNone(self.invitation.sent_time)


class JinjaEmailValidationTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(
            user=User.objects.create_superuser('admin', 'admin@example.com', 'pw'))
        organization = models.Organization.objects.create(name='Camp Org')
        self.event = models.Event.objects.create(organization=organization, name='Camp',
                                                 confirmation_email_engine='mustache')

    def patch_event(self, **fields):
        return self.client.patch(f'/api/events/{self.event.id}/', fields, format='json')

    def test_jinja_templates_must_parse(self):
        response = self.patch_event(confirmation_email_engine='jinja',
                                    confirmation_email_template='ok\n{% if %}')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(response.data['confirmation_email_template'][0].startswith('Line 2: '))

        # Switching an existing broken template to Jinja is checked too.
        self.assertEqual(self.patch_event(confirmation_email_subject='{{ }').status_code, 200)
        response = self.patch_event(confirmation_email_engine='jinja')
        self.assertIn('confirmation_email_subject', response.data)

    def test_mustache_templates_are_not_checked(self):
        self.assertEqual(self.patch_event(confirmation_email_template='{% if %}').status_code, 200)

    def test_registration_types(self):
        response = self.client.post('/api/registrationtypes/', {
            'event': self.event.id, 'name': 'staff', 'label': 'Staff',
            'invitation_email_subject': 'Hi', 'invitation_email_engine': 'jinja',
            'invitation_email_template': '{% for x in y %}',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('invitation_email_template', response.data)


class EmailCheckTests(APITestCase):
    def setUp(self):
        from tests.factories import create_template_event
        self.made = create_template_event()
        self.event = self.made.event

    def result(self, kind):
        return [r for r in check_event_templates(self.event) if r.kind == kind]

    def test_mustache_emails_are_skipped(self):
        self.event.confirmation_email_engine = models.TemplateEngine.MUSTACHE
        self.event.save()
        [confirmation] = self.result('confirmation_email')
        self.assertEqual(confirmation.mode, 'skipped')

    def test_confirmation_renders_for_every_registration(self):
        self.event.confirmation_email_engine = JINJA
        # Only Pat's registration has a second camper.
        self.event.confirmation_email_template = '{{ campers[1].attributes.first_name }}'
        self.event.save()
        [confirmation] = self.result('confirmation_email')
        self.assertEqual(confirmation.mode, 'rendered')
        [error] = confirmation.errors
        self.assertTrue(error.message.endswith('(1 of 2)'), error.message)

    def test_invitations_render_with_each_invitation(self):
        registration_type = models.RegistrationType.objects.get(event=self.event, name='staff')
        registration_type.invitation_email_engine = JINJA
        registration_type.invitation_email_template = '{{ invitation.recipient_emial }}'
        registration_type.save()
        [invitation] = self.result('invitation_email')
        self.assertEqual(invitation.mode, 'rendered')
        self.assertEqual(invitation.label, 'Invitation email: Staff')
        [warning] = invitation.warnings
        self.assertIn("invitation has no field 'recipient_emial'", warning.message)

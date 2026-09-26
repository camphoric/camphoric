'''
Confirmation and invitation emails: email templates in Jinja (SPEC §8.3, §8.4,
DR-45). Mustache emails were converted by migration 0065 (test_mustache).
'''

from django.contrib.auth.models import User
from django.core import mail
from rest_framework.test import APITestCase

from camphoric import models
from camphoric.templating.checks import check_event_templates
from tests.factories import set_email


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
            confirmation_email_from='reg@camp.org',
        )
        set_email(self.event.confirmation_template,
                  'Welcome, {{ campers[0].attributes.first_name }}', (
                      '# Thanks!\n'
                      '{% for camper in campers %}* {{ camper.attributes.first_name }}: '
                      '{{ camper.pricing.total | money }}\n{% endfor %}'
                      'Paying now: {{ initial_payment.total | money }}'))

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
        set_email(self.event.confirmation_template, body='Hello\n{{ registration.nope.deeper }}')

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
        set_email(self.event.confirmation_template, subject='{{ campers[0].nope.deeper }}')
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
            event=self.event, name='staff', label='Staff')
        set_email(self.registration_type.invitation_template,
                  '{{ registration_type.label }} registration for {{ event.name }}', (
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
        set_email(self.registration_type.invitation_template, body='{{ invitation.nope.deeper }}')
        response = self.send()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['diagnostics'][0]['message'],
                         "invitation has no field 'nope'")
        self.assertEqual(mail.outbox, [])
        self.invitation.refresh_from_db()
        self.assertIsNone(self.invitation.sent_time)


class EmailTemplateApiTests(APITestCase):
    '''Every email is a template (DR-45): created with its event or type, checked on save.'''
    def setUp(self):
        self.client.force_authenticate(
            user=User.objects.create_superuser('admin', 'admin@example.com', 'pw'))
        organization = models.Organization.objects.create(name='Camp Org')
        self.event = models.Event.objects.create(organization=organization, name='Camp')
        self.template = self.event.confirmation_template

    def patch(self, **fields):
        return self.client.patch(f'/api/emailtemplates/{self.template.id}/', fields,
                                 format='json')

    def test_new_events_and_types_get_their_templates(self):
        self.assertEqual(self.template.purpose, models.EmailTemplatePurpose.CONFIRMATION)
        self.assertEqual(self.template.event, self.event)
        self.assertIn('{{ event.name }}', self.template.subject)
        response = self.client.post('/api/registrationtypes/', {
            'event': self.event.id, 'name': 'staff', 'label': 'Staff'}, format='json')
        self.assertEqual(response.status_code, 201)
        invitation = models.EmailTemplate.objects.get(id=response.data['invitation_template'])
        self.assertEqual(invitation.purpose, models.EmailTemplatePurpose.INVITATION)
        self.assertEqual(invitation.name, 'Invitation: Staff')
        self.assertIn('{{ invitation.register_url }}', invitation.body)

    def test_templates_must_parse(self):
        response = self.patch(body='ok\n{% if %}')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(response.data['body'][0].startswith('Line 2: '))
        self.assertIn('subject', self.patch(subject='{{ }').data)
        self.assertEqual(self.patch(subject='Hi {{ event.name }}').status_code, 200)

    def test_purpose_and_event_are_fixed(self):
        self.assertIn('purpose', self.patch(purpose='group').data)
        response = self.client.post('/api/emailtemplates/', {
            'event': self.event.id, 'purpose': 'confirmation', 'name': 'Another'},
            format='json')
        self.assertEqual(response.status_code, 400)
        response = self.client.post('/api/emailtemplates/', {
            'event': self.event.id, 'purpose': 'group', 'name': 'Newsletter'}, format='json')
        self.assertEqual(response.status_code, 201)

    def test_automatic_templates_cannot_be_deleted(self):
        response = self.client.delete(f'/api/emailtemplates/{self.template.id}/')
        self.assertEqual(response.status_code, 409)

    def test_the_event_link_is_read_only(self):
        other = models.EmailTemplate.objects.create(event=self.event, purpose='group', name='x')
        self.client.patch(f'/api/events/{self.event.id}/', {'confirmation_template': other.id},
                          format='json')
        self.event.refresh_from_db()
        self.assertEqual(self.event.confirmation_template, self.template)

    def test_listed_by_event_and_purpose(self):
        response = self.client.get(
            f'/api/emailtemplates/?event={self.event.id}&purpose=confirmation')
        self.assertEqual([t['id'] for t in response.data], [self.template.id])


class EmailCheckTests(APITestCase):
    def setUp(self):
        from tests.factories import create_template_event
        self.made = create_template_event()
        self.event = self.made.event

    def result(self, kind):
        return [r for r in check_event_templates(self.event) if r.kind == kind]

    def test_confirmation_renders_for_every_registration(self):
        # Only Pat's registration has a second camper.
        set_email(self.event.confirmation_template, body='{{ campers[1].attributes.first_name }}')
        [confirmation] = self.result('confirmation_email')
        self.assertEqual(confirmation.mode, 'rendered')
        [error] = confirmation.errors
        self.assertTrue(error.message.endswith('(1 of 2)'), error.message)

    def test_invitations_render_with_each_invitation(self):
        registration_type = models.RegistrationType.objects.get(event=self.event, name='staff')
        set_email(registration_type.invitation_template, body='{{ invitation.recipient_emial }}')
        [invitation] = self.result('invitation_email')
        self.assertEqual(invitation.mode, 'rendered')
        self.assertEqual(invitation.label, 'Invitation email: Staff')
        [warning] = invitation.warnings
        self.assertIn("invitation has no field 'recipient_emial'", warning.message)


class ConfirmationPageTests(APITestCase):
    '''The confirmation page renders on the server (SPEC §7.3, DR-42).'''

    setUp = JinjaConfirmationEmailTests.setUp
    register = JinjaConfirmationEmailTests.register

    def test_the_payment_step_returns_the_rendered_page(self):
        self.event.confirmation_page_template = (
            '# Thanks, {{ campers[0].attributes.first_name }}!\n'
            'Paying now: {{ initial_payment.total | money }} by {{ registration.payment_type }}')
        self.event.save()
        response = self.register()
        self.assertEqual(response.data['confirmationPage'],
                         '# Thanks, Pat!\nPaying now: $100.00 by Check')
        self.assertNotIn('confirmationPageTemplate', response.data)

    def test_a_broken_page_shows_a_fallback_and_reports_it(self):
        self.event.confirmation_page_template = 'Hi {{ registration.nope.deeper }}'
        self.event.save()
        response = self.register()
        self.assertEqual(response.data['confirmationPage'],
                         '# Thank you — your registration is complete!')
        self.assertTrue(models.Registration.objects.get().completed)
        reports = [m for m in mail.outbox if m.subject.startswith('Confirmation page not shown')]
        [report] = reports
        self.assertEqual(report.to, ['reg@camp.org'])
        self.assertIn("registration has no field 'nope'", report.body)
        # The confirmation email still goes out.
        self.assertIn(['pat@example.com'], [m.to for m in mail.outbox])

    def test_the_template_must_parse(self):
        from django.contrib.auth.models import User
        self.client.force_authenticate(
            user=User.objects.create_superuser('admin', 'admin@example.com', 'pw'))
        response = self.client.patch(f'/api/events/{self.event.id}/',
                                     {'confirmation_page_template': '{{#if x}}'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(response.data['confirmation_page_template'][0].startswith('Line 1: '))

    def test_preview_and_check(self):
        from camphoric.templating.checks import check_event_templates
        self.event.confirmation_page_template = '{{ registration.frist }}'
        self.event.save()
        self.register()
        [result] = [r for r in check_event_templates(self.event) if r.kind == 'confirmation_page']
        self.assertEqual(result.mode, 'rendered')
        self.assertIn("registration has no field 'frist'", result.warnings[0].message)

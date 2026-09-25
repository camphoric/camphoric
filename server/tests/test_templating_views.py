from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from camphoric import models

from tests.factories import create_template_event


def fields_of(payload, type_name):
    return {f['name']: f for f in payload['types'][type_name]['fields']}


class TemplateDescribeTests(APITestCase):
    def setUp(self):
        self.made = create_template_event()
        self.url = f'/api/events/{self.made.event.id}/templates/describe'
        self.client.force_authenticate(
            user=User.objects.create_superuser('admin', 'admin@example.com', 'pw'))

    def test_requires_admin(self):
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(self.url).status_code, (401, 403))
        staff = User.objects.create_user('someone', 'someone@example.com', 'pw')
        self.client.force_authenticate(user=staff)
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_describes_contexts_types_and_filters(self):
        payload = self.client.get(self.url).json()
        self.assertEqual(
            set(payload['contexts']),
            {'report', 'confirmation_email', 'invitation_email', 'bulk_email_registration',
             'bulk_email_camper', 'bulk_email_manual'})
        roots = {r['name']: r for r in payload['contexts']['report']['roots']}
        self.assertEqual(roots['campers']['type'], 'list<camper>')
        event = fields_of(payload, 'event')
        self.assertEqual(event['nights']['type'], 'list<date>')
        self.assertIn('doc', event['nights'])
        self.assertIn('money', {f['name'] for f in payload['filters']})
        date_fields = fields_of(payload, 'date')
        self.assertTrue(date_fields['strftime']['callable'])

    def test_describes_the_events_own_forms(self):
        payload = self.client.get(self.url).json()
        camper = fields_of(payload, 'attributes:camper')
        self.assertEqual(camper['first_name']['title'], 'First name')
        self.assertEqual(camper['linens']['type'], 'bool')
        self.assertEqual(camper['meal_type']['enum'], ['Omnivore', 'Vegetarian'])
        # A field that only exists in a dependency branch.
        self.assertEqual(camper['license_plate']['title'], 'License plate')
        # The branch discriminator doesn't replace the real definition.
        self.assertEqual(camper['driving']['title'], 'Driving?')
        self.assertEqual(camper['emergency_contact']['type'], 'attributes:camper.emergency_contact')
        self.assertIn('phone', fields_of(payload, 'attributes:camper.emergency_contact'))
        self.assertEqual(camper['attendance']['type'], 'list<string>')
        # $refs into the registration form's definitions resolve.
        self.assertIn('street', fields_of(payload, 'attributes:camper.mailing_address'))

        registration = fields_of(payload, 'attributes:registration')
        self.assertNotIn('campers', registration)
        self.assertFalse(registration['donation-note']['identifier'])
        self.assertTrue(registration['comments']['identifier'])
        self.assertIn('registration type: Staff', registration['staff_role']['doc'])

        self.assertIn('checked_in', fields_of(payload, 'admin_attributes:camper'))
        pricing = fields_of(payload, 'pricing:registration')
        self.assertEqual(set(pricing), {'donation', 'tuition', 'total', 'handling'})
        self.assertEqual(set(fields_of(payload, 'pricing:event')), {'adult', 'linen_rate'})


class TemplatePreviewTests(APITestCase):
    def setUp(self):
        self.made = create_template_event()
        self.url = f'/api/events/{self.made.event.id}/templates/preview'
        self.client.force_authenticate(
            user=User.objects.create_superuser('admin', 'admin@example.com', 'pw'))

    def preview(self, **body):
        return self.client.post(self.url, body, format='json')

    def test_renders_unsaved_report_text(self):
        response = self.preview(context='report', output='csv',
                                template='{{ campers | length }},{{ event.name | csv }}')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['output'], '3,Test Camp')
        self.assertEqual(data['diagnostics'], [])
        self.assertIsNone(data['sample'])

    def test_template_errors_are_diagnostics(self):
        data = self.preview(context='report', output='md', template='{% if %}').json()
        self.assertEqual(data['diagnostics'][0]['kind'], 'syntax')
        self.assertEqual(data['diagnostics'][0]['line'], 1)

    def test_confirmation_email_with_a_sample_registration(self):
        data = self.preview(
            context='confirmation_email', output='email',
            registration_id=self.made.r2.id,
            subject='Welcome {{ registration.registrant_email }}',
            template='# Hi\n{% for c in campers %}* {{ c.attributes.first_name }}\n{% endfor %}'
                     'Total: {{ pricing.total | money }}').json()
        self.assertEqual(data['subject'], 'Welcome lee@example.com')
        self.assertIn('* Lee', data['output'])
        self.assertIn('<h1>Hi</h1>', data['html'])
        self.assertIn('$400.00', data['output'])
        self.assertEqual(data['sample'], {'kind': 'registration', 'id': self.made.r2.id,
                                          'label': f'Registration #{self.made.r2.id} '
                                                   '(lee@example.com)'})

    def test_defaults_to_the_first_completed_registration(self):
        data = self.preview(context='confirmation_email', output='email',
                            template='{{ registration.registrant_email }}').json()
        self.assertEqual(data['output'], 'pat@example.com')

    def test_invitation_preview_uses_an_example_when_none_sent(self):
        other = models.RegistrationType.objects.create(
            event=self.made.event, name='band', label='Band', invitation_email_subject='x')
        data = self.preview(context='invitation_email', output='email',
                            registration_type_id=other.id,
                            template='{{ invitation.recipient_name }} / '
                                     '{{ registration_type.label }}').json()
        self.assertEqual(data['output'], 'Alex Sample / Band')

    def test_bulk_camper_context(self):
        data = self.preview(context='bulk_email_camper', output='email', camper_id=self.made.c3.id,
                            template='{{ recipient.email }} {{ camper.attributes.first_name }}'
                            ).json()
        self.assertEqual(data['output'], 'lee@example.com Lee')

    def test_bad_requests(self):
        self.assertEqual(self.preview(context='nope', template='').status_code, 400)
        self.assertEqual(
            self.preview(context='report', output='pdf', template='').status_code, 400)
        other_event = models.Event.objects.create(
            organization=self.made.organization, name='Other')
        other = models.Registration.objects.create(
            event=other_event, registrant_email='x@example.com', completed=True)
        response = self.preview(context='confirmation_email', output='email', template='',
                                registration_id=other.id)
        self.assertEqual(response.status_code, 400)


class LegacyReportRenderTests(APITestCase):
    '''Reports whose variables the client posts still render — now sandboxed.'''

    def setUp(self):
        self.made = create_template_event()
        self.client.force_authenticate(
            user=User.objects.create_superuser('admin', 'admin@example.com', 'pw'))

    def render(self, template, data):
        report = models.Report.objects.create(
            event=self.made.event, title='r', output='csv', template=template)
        return self.client.post(f'/api/reports/{report.id}/render', data, format='json').json()

    def test_renders_posted_variables_and_allows_updates(self):
        data = self.render(
            "{% for c in campers %}{% do c.update({'x': 1}) %}{{ c.name }}{{ c.x }},{% endfor %}"
            "{{ '%.2f' | format(3.14159) }}|{{ 'a1b2' | regex_replace('[0-9]', '') }}",
            {'campers': [{'name': 'A'}, {'name': 'B'}]})
        self.assertIsNone(data['error'])
        self.assertEqual(data['report'], 'A1,B1,3.14|ab')

    def test_blocks_python_internals(self):
        data = self.render("{{ ''.__class__.__mro__ }}", {})
        self.assertIn('unsafe', data['error'])


class ServerReportTests(APITestCase):
    '''Reports that use the server's variables (variables_source = server).'''

    def setUp(self):
        self.made = create_template_event()
        self.client.force_authenticate(
            user=User.objects.create_superuser('admin', 'admin@example.com', 'pw'))

    def create(self, **fields):
        return self.client.post('/api/reports/', {
            'event': self.made.event.id, 'title': 'Campers', 'output': 'csv',
            'variables_source': 'server', 'template': '', **fields,
        }, format='json')

    def render(self, report_id, body=None):
        return self.client.post(f'/api/reports/{report_id}/render', body or {},
                                format='json').json()

    def test_renders_from_the_server_ignoring_the_body(self):
        report = self.create(template="{% for c in campers | sort(attribute='attributes."
                                      "first_name') %}{{ c.attributes.first_name }},"
                                      "{% endfor %}").json()
        data = self.render(report['id'], {'campers': [{'attributes': {'first_name': 'X'}}]})
        self.assertEqual(data, {'report': 'Lee,Pat,Sam,', 'error': None, 'diagnostics': []})

    def test_reports_diagnostics(self):
        report = self.create(template='ok\n{{ campers[0].nope.deeper }}').json()
        data = self.render(report['id'])
        self.assertEqual(data['report'], '')
        self.assertEqual(data['error'], "camper has no field 'nope'")
        self.assertEqual(data['diagnostics'][0]['line'], 2)

    def test_new_reports_default_to_client_variables(self):
        report = self.client.post('/api/reports/', {
            'event': self.made.event.id, 'title': 'Old', 'output': 'csv', 'template': ''},
            format='json').json()
        self.assertEqual(report['variables_source'], 'client')

    def test_handlebars_reports_cannot_use_server_variables(self):
        response = self.create(output='hbs')
        self.assertEqual(response.status_code, 400)
        self.assertIn('variables_source', response.json())
        report = models.Report.objects.create(event=self.made.event, title='H', output='hbs')
        response = self.client.patch(f'/api/reports/{report.id}/',
                                     {'variables_source': 'server'}, format='json')
        self.assertEqual(response.status_code, 400)


class TemplateCheckTests(APITestCase):
    def setUp(self):
        self.made = create_template_event()
        self.client.force_authenticate(
            user=User.objects.create_superuser('admin', 'admin@example.com', 'pw'))
        event = self.made.event
        self.good = models.Report.objects.create(
            event=event, title='Good', output='csv', variables_source='server',
            template='{{ campers | length }}')
        self.typo = models.Report.objects.create(
            event=event, title='Typo', output='md', variables_source='server',
            template='{{ campers[0].frist_name }}')
        self.broken_legacy = models.Report.objects.create(
            event=event, title='Legacy broken', output='csv', template='{% if %}')
        self.handlebars = models.Report.objects.create(
            event=event, title='Hbs', output='hbs', template='{{#each campers}}{{/each}}')

    def test_endpoint(self):
        data = self.client.get(f'/api/events/{self.made.event.id}/templates/check').json()
        self.assertFalse(data['ok'])
        by_title = {r['label']: r for r in data['results']}
        self.assertEqual(by_title['Good']['mode'], 'rendered')
        self.assertEqual(by_title['Good']['diagnostics'], [])
        self.assertEqual(by_title['Typo']['diagnostics'][0]['severity'], 'warning')
        self.assertEqual(by_title['Legacy broken']['mode'], 'parsed')
        self.assertEqual(by_title['Legacy broken']['diagnostics'][0]['kind'], 'syntax')
        self.assertEqual(by_title['Hbs']['mode'], 'skipped')

    def test_command(self):
        from io import StringIO
        from django.core.management import call_command
        from django.core.management.base import CommandError

        out = StringIO()
        with self.assertRaises(CommandError):
            call_command('check_templates', '--event', str(self.made.event.id), stdout=out)
        self.assertIn('FAIL  report "Legacy broken" (parsed)', out.getvalue())
        self.assertIn('ok    report "Typo" (rendered)', out.getvalue())

        self.broken_legacy.delete()
        out = StringIO()
        call_command('check_templates', '--all', stdout=out)
        self.assertIn('All templates OK.', out.getvalue())
        with self.assertRaises(CommandError):
            call_command('check_templates', '--all', '--strict', stdout=StringIO())

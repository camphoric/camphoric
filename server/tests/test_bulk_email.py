'''
Bulk email from registrations, campers or a typed list (SPEC §8.9, DR-39).
The Mustache send/cancel/resume machinery is covered by test_mail.
'''

from unittest import mock

from django.contrib.auth.models import User
from django.core import mail
from django.core.management import call_command
from rest_framework.test import APITestCase

from camphoric import models
from camphoric.templating.bulk import Criteria, resolve_recipients
from camphoric.templating.checks import check_event_templates

from tests.factories import create_template_event

Kind = models.BulkRecipientKind


def emails(resolution):
    return [c.email for c in resolution.recipients]


class ResolveTests(APITestCase):
    def setUp(self):
        self.made = create_template_event()
        self.event = self.made.event

    def resolve(self, **criteria):
        return resolve_recipients(self.event, Criteria(**criteria))

    def test_registrations(self):
        self.assertEqual(emails(self.resolve(kind=Kind.REGISTRATIONS)),
                         ['pat@example.com', 'lee@example.com'])
        self.assertEqual(emails(self.resolve(kind=Kind.REGISTRATIONS, include_incomplete=True)),
                         ['pat@example.com', 'lee@example.com', 'drew@example.com'])
        owing = self.resolve(kind=Kind.REGISTRATIONS, recipient_filter='registration.balance > 0')
        self.assertEqual(emails(owing), ['pat@example.com'])
        self.assertEqual(owing.recipients[0].registration, self.made.r1.id)

    def test_campers_share_addresses_once(self):
        result = self.resolve(kind=Kind.CAMPERS)
        self.assertEqual(emails(result), ['pat@example.com', 'lee@example.com'])
        self.assertEqual(result.recipients[0].name, 'Pat Alpha')
        self.assertEqual(result.recipients[0].camper, self.made.c1.id)
        [skipped] = result.skipped
        self.assertEqual((skipped.label, skipped.reason),
                         (f'Sam Alpha (camper #{self.made.c2.id})', 'duplicate'))

    def test_custom_expressions_and_reasons(self):
        result = self.resolve(
            kind=Kind.CAMPERS,
            recipient_filter="camper.attributes.first_name != 'Sam'",
            address_expression="camper.attributes.first_name | lower ~ '@camp.org' "
                               "if camper.attributes.first_name == 'Pat' else "
                               "('not an address' if camper.attributes.first_name == 'Lee')",
            name_expression='camper.attributes.last_name')
        self.assertEqual(emails(result), ['pat@camp.org'])
        self.assertEqual(result.recipients[0].name, 'Alpha')
        self.assertEqual([s.reason for s in result.skipped], ['invalid'])

    def test_expression_errors(self):
        broken = self.resolve(kind=Kind.REGISTRATIONS, recipient_filter='registration.balance >')
        self.assertFalse(broken.ok)
        self.assertEqual(broken.diagnostics[0].field, 'recipient_filter')
        failing = self.resolve(kind=Kind.REGISTRATIONS,
                               recipient_filter='registration.nope.deeper')
        self.assertEqual([s.reason for s in failing.skipped], ['filter_error', 'filter_error'])
        self.assertIn("has no field 'nope'", failing.skipped[0].detail)

    def test_typed_list(self):
        result = self.resolve(kind=Kind.MANUAL, recipient_list=(
            'Ann Smith <ann@example.com>\n\n# a comment\nbob@example.com\nANN@example.com\n'
            'nonsense'))
        self.assertEqual(emails(result), ['ann@example.com', 'bob@example.com'])
        self.assertEqual(result.recipients[0].name, 'Ann Smith')
        self.assertEqual([s.reason for s in result.skipped], ['duplicate', 'invalid'])


class BulkEmailApiTests(APITestCase):
    def setUp(self):
        self.made = create_template_event()
        self.event = self.made.event
        self.admin = User.objects.create_superuser('admin', 'admin@example.com', 'pw')
        self.client.force_authenticate(user=self.admin)

    def create(self, **fields):
        response = self.client.post('/api/bulkemailtasks/', {
            'event': self.event.id, 'from_email': 'reg@camp.org', 'engine': 'jinja',
            'subject': 'Balance for {{ registration.registrant_email }}',
            'body_template': 'You owe {{ registration.balance | money }} for '
                             '{{ campers | length }} camper(s).',
            'recipient_kind': 'registrations',
            'recipient_filter': 'registration.balance > 0',
            **fields,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_preview_criteria_without_a_task(self):
        response = self.client.post(f'/api/events/{self.event.id}/bulkemail/recipients', {
            'recipient_kind': 'campers', 'recipient_filter': "camper.attributes.linens",
        }, format='json')
        self.assertEqual([r['email'] for r in response.data['recipients']], ['pat@example.com'])
        self.assertEqual(response.data['recipients'][0]['label'],
                         f'Pat Alpha (camper #{self.made.c1.id})')

    def test_saving_checks_templates_and_expressions(self):
        response = self.client.post('/api/bulkemailtasks/', {
            'event': self.event.id, 'from_email': 'reg@camp.org', 'engine': 'jinja',
            'subject': 'Hi', 'body_template': '{% if %}', 'recipient_kind': 'registrations',
            'recipient_filter': 'registration.balance >',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('recipient_filter', response.data)
        response = self.client.post('/api/bulkemailtasks/', {
            'event': self.event.id, 'from_email': 'reg@camp.org', 'engine': 'jinja',
            'subject': 'Hi', 'body_template': '{% if %}', 'recipient_kind': 'registrations',
        }, format='json')
        self.assertIn('body_template', response.data)

    def test_resolve_send_and_status(self):
        task = self.create()
        self.assertEqual((task['status'], task['recipient_count']), ('draft', 0))

        url = f"/api/bulkemailtasks/{task['id']}"
        dry = self.client.post(f'{url}/recipients/resolve', {'dry_run': True}, format='json')
        self.assertEqual(dry.data['counts']['recipients'], 1)
        self.assertEqual(models.BulkEmailRecipient.objects.count(), 0)

        response = self.client.post(f'{url}/send')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'finished')
        self.assertEqual((response.data['recipient_count'], response.data['sent_count']), (1, 1))
        [message] = mail.outbox
        self.assertEqual(message.to, ['pat@example.com'])
        self.assertEqual(message.subject, 'Balance for pat@example.com')
        self.assertEqual(message.body, 'You owe $725.00 for 2 camper(s).')

        # Sending again rebuilds the list but never re-sends.
        models.Payment.objects.create(registration=self.made.r2, amount=-100, paid_on='2026-10-01')
        self.client.post(f'{url}/send')
        self.assertEqual([m.to[0] for m in mail.outbox], ['pat@example.com', 'lee@example.com'])
        self.assertEqual(self.client.get(f'{url}/').data['sent_count'], 2)

    def test_a_copy_that_cant_render_is_recorded_and_skipped(self):
        # Only Lee's registration has a staff role.
        task = self.create(recipient_filter='',
                           body_template='{{ registration.attributes.staff_role.upper() }}')
        self.client.post(f"/api/bulkemailtasks/{task['id']}/send")
        self.assertEqual([m.to[0] for m in mail.outbox], ['lee@example.com'])
        self.assertEqual(mail.outbox[0].body, 'COOK')
        failed = models.BulkEmailRecipient.objects.get(email='pat@example.com')
        self.assertIsNone(failed.sent_time)
        self.assertTrue(failed.error.startswith('Template problem (template line 1: '))
        data = self.client.get(f"/api/bulkemailtasks/{task['id']}/").data
        self.assertEqual((data['sent_count'], data['error_count']), (1, 1))

    def test_test_send(self):
        task = self.create()
        response = self.client.post(f"/api/bulkemailtasks/{task['id']}/test", {}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['rendered_for'], 'pat@example.com')
        [message] = mail.outbox
        self.assertEqual(message.to, ['admin@example.com'])
        self.assertEqual(message.subject, '[Test] Balance for pat@example.com')
        # Nobody on the list is marked as sent.
        self.assertFalse(models.BulkEmailRecipient.objects.filter(sent_time__isnull=False).exists())

    def test_background_send(self):
        task = self.create()
        with mock.patch('camphoric.views.subprocess.Popen') as popen:
            popen.return_value.pid = 4321
            response = self.client.post(f"/api/bulkemailtasks/{task['id']}/send?background=1")
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data['status'], 'running')
        args = popen.call_args.args[0]
        self.assertEqual(args[-2:], ['send_bulk_email', str(task['id'])])
        self.assertEqual(models.BulkEmailRecipient.objects.count(), 1)  # list built first

        # What the background process runs:
        models.BulkEmailTask.objects.filter(id=task['id']).update(running_pid=None)
        call_command('send_bulk_email', str(task['id']), stdout=mock.Mock())
        self.assertEqual(len(mail.outbox), 1)

    def test_api_built_lists_are_kept(self):
        task = self.create(recipient_kind='manual', recipient_filter='', engine='mustache',
                           subject='Hi', body_template='Hi {{recipient.email}}')
        models.BulkEmailRecipient.objects.create(task_id=task['id'], email='x@example.com')
        self.client.post(f"/api/bulkemailtasks/{task['id']}/send")
        self.assertEqual([m.to[0] for m in mail.outbox], ['x@example.com'])

    def test_check_templates_renders_unsent_tasks(self):
        self.create(body_template='{{ registration.frist }}')
        [result] = [r for r in check_event_templates(self.event) if r.kind == 'bulk_email']
        self.assertEqual(result.mode, 'rendered')
        self.assertIn("registration has no field 'frist'", result.warnings[0].message)

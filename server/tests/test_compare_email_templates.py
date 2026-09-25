'''manage.py compare_email_templates (converting data/ emails to Jinja, DR-40).'''

from io import StringIO
import json
import tempfile

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from camphoric import models
from camphoric.management.commands.compare_email_templates import normalize

from tests.factories import create_template_event


class NormalizeTests(TestCase):
    def test_expected_differences_compare_equal(self):
        self.assertEqual(normalize('Total: $825.0 &amp; $1234.5'), 'Total: $825.00 & $1,234.50')
        self.assertEqual(normalize('Owed: $-50.5'), normalize('Owed: -$50.50'))
        # A markdown hard break survives; other trailing space and extra blank lines don't.
        self.assertEqual(normalize('a    \nb \n\n\n\nc'), 'a  \nb\n\nc')


class CompareEmailTemplatesTests(TestCase):
    def setUp(self):
        self.made = create_template_event()
        event = self.made.event
        event.confirmation_email_engine = 'mustache'
        event.confirmation_email_subject = 'Thanks'
        event.confirmation_email_template = (
            'Hi {{campers.0.first_name}} & co\n{{#campers}}\n- {{first_name}}: '
            '${{pricing_result.total}}\n{{/campers}}\nTotal: ${{pricing_results.total}}')
        event.save()
        models.RegistrationType.objects.filter(event=event).update(
            invitation_email_engine='mustache', invitation_email_subject='Join',
            invitation_email_template='Hi {{recipient_name}}: {{register_link}}')

    def run_command(self, confirmation, invitation):
        with tempfile.NamedTemporaryFile('w', suffix='.json') as file:
            json.dump({
                'confirmation': {'engine': 'jinja', 'subject': 'Thanks', 'template': confirmation},
                'registration_types': [{'name': 'staff', 'engine': 'jinja', 'subject': 'Join',
                                        'template': invitation}],
            }, file)
            file.flush()
            out = StringIO()
            try:
                call_command('compare_email_templates', '--event', str(self.made.event.id),
                             '--templates', file.name, stdout=out)
            except CommandError as error:
                return out.getvalue(), error
            return out.getvalue(), None

    def test_equivalent_templates(self):
        out, error = self.run_command(
            'Hi {{ campers[0].attributes.first_name }} & co\n{%- for camper in campers %}\n'
            '- {{ camper.attributes.first_name }}: {{ camper.pricing.total | money }}\n'
            '{%- endfor %}\nTotal: {{ pricing.total | money }}',
            'Hi {{ invitation.recipient_name or invitation.recipient_email }}: '
            '{{ invitation.register_url }}')
        self.assertIsNone(error, out)
        self.assertIn('ok    Confirmation email: 2 the same', out)
        self.assertIn("ok    Invitation email 'staff'", out)

    def test_differences_and_failures_are_reported(self):
        out, error = self.run_command('Hello {{ campers[5].attributes.x }}', 'Hi')
        self.assertIsNotNone(error)
        self.assertIn('DIFF  Confirmation email: 0 the same, 0 different, 2 failed to render', out)
        self.assertIn("DIFF  Invitation email 'staff': 0 the same, 2 different", out)
        self.assertIn('+Hi', out)

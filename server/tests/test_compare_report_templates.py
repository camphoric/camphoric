'''manage.py compare_report_templates (converting data/ reports, DR-41).'''

from io import StringIO
import json
import tempfile

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from camphoric import models
from camphoric.management.commands.compare_report_templates import normalize

from tests.factories import create_template_event


class NormalizeTests(TestCase):
    def test_csv_compares_cells(self):
        self.assertEqual(normalize('csv', 'a, "b",725.00,None\n\n'),
                         normalize('csv', '"a",b,725,'))
        self.assertNotEqual(normalize('csv', 'a,b'), normalize('csv', 'a,c'))

    def test_text_and_tables(self):
        self.assertEqual(normalize('md', '|a|  $1,234.50 |\n|:-|---|\n\n\n\nx &amp; y None'),
                         normalize('md', '| a | $1234.5 |\n| --- | --- |\n\nx & y '))
        # Dates aren't numbers.
        self.assertEqual(normalize('txt', '2026-12-30'), ['2026-12-30'])


class CompareReportTemplatesTests(TestCase):
    def setUp(self):
        self.made = create_template_event()
        event = self.made.event
        self.legacy_bundle = {'campers': [
            {'attributes': {'first_name': 'Pat'}, 'lodging': 1},
            {'attributes': {'first_name': 'Sam'}, 'lodging': 2},
        ]}
        models.Report.objects.create(
            event=event, title='Names', output='csv', variables_source='client',
            template='Name\n{% for c in campers %}{{ c.attributes.first_name }},\n{% endfor %}')
        models.Report.objects.create(
            event=event, title='Payments', output='hbs', variables_source='client',
            template='{{#each campers}}x{{/each}}')

    def run_command(self, candidates, handlebars=None, *extra):
        with tempfile.NamedTemporaryFile('w', suffix='.json') as reports, \
                tempfile.NamedTemporaryFile('w', suffix='.json') as legacy:
            json.dump(candidates, reports)
            json.dump({'bundle': self.legacy_bundle, 'handlebars': handlebars or {}}, legacy)
            reports.flush()
            legacy.flush()
            out = StringIO()
            try:
                call_command('compare_report_templates', '--event', str(self.made.event.id),
                             '--reports', reports.name, '--legacy', legacy.name, *extra,
                             stdout=out)
            except CommandError as error:
                return out.getvalue(), error
            return out.getvalue(), None

    def candidate(self, title, template, output='csv'):
        return {'title': title, 'output': output, 'variables_source': 'server',
                'template': template}

    def test_same_and_order_only(self):
        out, error = self.run_command([self.candidate(
            'Names', "Name\n{% for c in campers if c.attributes.first_name in ['Pat', 'Sam'] %}"
                     "{{ c.attributes.first_name }}\n{% endfor %}")], None, '--only', 'Names')
        self.assertIsNone(error, out)
        self.assertIn('same  Names', out)

        out, error = self.run_command([self.candidate(
            'Names', 'Name\nSam\nPat\n')], None, '--only', 'Names')
        self.assertIsNone(error, out)
        self.assertIn('order Names', out)

    def test_differences_failures_and_handlebars(self):
        out, error = self.run_command([
            self.candidate('Names', 'Name\nPat\n'),
            self.candidate('Payments', '| {{ event.nope.x }} |', output='md'),
        ], {'Payments': '| x |'})
        self.assertIsNotNone(error)
        self.assertIn('DIFF  Names', out)
        self.assertIn('-Sam', out)
        self.assertIn('FAIL  Payments', out)

        out, error = self.run_command([self.candidate('Payments', '|x|', output='md')],
                                      {'Payments': '| x |'}, '--only', 'Payments')
        self.assertIsNone(error, out)

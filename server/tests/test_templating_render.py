import datetime
from decimal import Decimal

from django.test import TestCase

from camphoric import models
from camphoric.templating import filters
from camphoric.templating.contexts import report_context
from camphoric.templating.graph import build_event_graph
from camphoric.templating.render import RenderLimits, render_template

from tests.factories import create_template_event


class RenderTests(TestCase):
    def setUp(self):
        self.made = create_template_event()
        self.context = report_context(build_event_graph(self.made.event))

    def render(self, source, **kwargs):
        return render_template(source, self.context, **kwargs)

    def errors(self, result):
        return [d for d in result.diagnostics if d.severity == 'error']

    def test_renders_resolved_relationships(self):
        result = self.render(
            "{% for c in campers | sort(attribute='attributes.first_name') %}"
            "{{ c.attributes.first_name }}: {{ c.lodging.full_name }}, "
            "{{ c.registration.registrant_email }}\n{% endfor %}")
        self.assertEqual(result.diagnostics, [])
        self.assertEqual(result.output,
                         'Lee: Tents→Tent 1, lee@example.com\n'
                         'Pat: Cabins→Cabin A, pat@example.com\n'
                         'Sam: Cabins→Cabin A, pat@example.com\n')

    def test_nights_replace_hardcoded_date_lists(self):
        result = self.render(
            "{% for c in campers | sort(attribute='attributes.first_name') %}"
            "{{ c.attributes.first_name }}{% for night in event.nights %},"
            "{{ 'X' if night in c.stay }}{% endfor %}\n{% endfor %}")
        self.assertEqual(result.output, 'Lee,X,X,X,,\nPat,X,X,,,\nSam,,X,,,\n')

    def test_none_renders_blank(self):
        result = self.render('[{{ campers[1].lodging_requested }}]')
        self.assertEqual(result.output, '[]')

    def test_syntax_error_has_a_line(self):
        result = self.render('line one\n{{ campers | }}\nline three')
        [error] = self.errors(result)
        self.assertEqual(error.kind, 'syntax')
        self.assertEqual(error.line, 2)

    def test_undefined_error_has_line_and_column(self):
        result = self.render('ok\n{{ campers[0].registration.nope.deeper }}')
        [error] = self.errors(result)
        self.assertEqual(error.kind, 'undefined')
        self.assertEqual(error.message, "registration has no field 'nope'")
        self.assertEqual(error.line, 2)
        self.assertEqual(error.column, len('{{ campers[0].registration.') + 1)
        self.assertEqual(result.output, 'ok\n')

    def test_typos_are_warnings(self):
        # Reported once per line, however often it's used there.
        result = self.render('{{ campers[0].frist_name }} {{ campers[0].frist_name }}')
        self.assertEqual(self.errors(result), [])
        [warning] = result.diagnostics
        self.assertEqual(warning.severity, 'warning')
        self.assertEqual(warning.message, "camper has no field 'frist_name'")
        self.assertEqual(warning.line, 1)

    def test_missing_form_answers_are_not_typos(self):
        result = self.render('{{ campers[1].attributes.linens }}')
        self.assertEqual(result.diagnostics, [])

    def test_sandbox_blocks_python_internals(self):
        result = self.render("{{ ''.__class__.__mro__ }}")
        [error] = self.errors(result)
        self.assertEqual(error.kind, 'security')

    def test_no_model_methods_are_reachable(self):
        result = self.render('{{ registrations[0].delete() }}')
        self.assertTrue(self.errors(result))
        self.assertEqual(models.Registration.objects.count(), 3)

    def test_camphoric_objects_are_read_only(self):
        for source in ("{% do campers[0].update({'x': 1}) %}",
                       "{% do campers[0].attributes.update({'x': 1}) %}",
                       '{% do campers.append(1) %}',
                       '{% do campers[0].stay.append(1) %}'):
            result = self.render(source)
            [error] = self.errors(result)
            self.assertEqual(error.kind, 'security', source)
            self.assertIn('read-only', error.message)
        self.assertNotIn('x', self.context['campers'][0])

    def test_templates_can_build_their_own_data(self):
        result = self.render(
            '{% set rows = [] %}{% for c in campers %}'
            "{% do rows.append({'name': c.attributes.first_name}"
            " | merge({'n': c.stay | length})) %}"
            "{% endfor %}{{ rows | map(attribute='n') | sum }}"
            '{% set ns = namespace(total=0) %}{% for r in registrations %}'
            '{% set ns.total = ns.total + r.balance %}{% endfor %} {{ ns.total | money }}')
        self.assertEqual(result.diagnostics, [])
        # Balances: 825.00 − 100.00 and 400.00 − 450.50.
        self.assertEqual(result.output, '6 $674.50')

    def test_cyclic_graph_prints_shallowly(self):
        result = self.render('{{ campers[0] }} {{ campers[0].registration }}')
        self.assertRegex(result.output, r'^<camper \d+> <registration \d+>$')
        # Two levels deep by default; further back-references become $refs.
        result = self.render('{{ campers[0] | tojson }}')
        self.assertIn('"campers": [{"$ref": "camper:', result.output)
        result = self.render('{{ campers[0] | dump(1) }}')
        self.assertIn('"$ref"', result.output)

    def test_output_limit(self):
        result = self.render("{% for i in range(1000) %}xxxxxxxxxx{% endfor %}",
                             limits=RenderLimits(timeout_s=5, max_output_chars=100))
        self.assertTrue(result.truncated)
        self.assertEqual(len(result.output), 100)
        self.assertEqual(self.errors(result)[0].kind, 'output_limit')

    def test_timeout(self):
        result = self.render(
            '{% for i in range(100000) %}{% for j in range(100000) %}{% endfor %}{% endfor %}',
            limits=RenderLimits(timeout_s=0.2, max_output_chars=100))
        [error] = self.errors(result)
        self.assertEqual(error.kind, 'timeout')

    def test_html_output_is_escaped(self):
        result = render_template('{{ "<b>" }}', {}, fmt='html')
        self.assertEqual(result.output, '&lt;b&gt;')


class FilterTests(TestCase):
    def test_money(self):
        self.assertEqual(filters.money(Decimal('1234.5')), '$1,234.50')
        self.assertEqual(filters.money(-12), '-$12.00')
        self.assertEqual(filters.money(None), '')
        self.assertEqual(filters.money('n/a'), 'n/a')

    def test_dates(self):
        day = datetime.date(2026, 12, 30)
        self.assertEqual(filters.format_date(day, '%a %b %d'), 'Wed Dec 30')
        self.assertEqual(filters.format_date('2026-12-30'), '2026-12-30')
        self.assertEqual(filters.to_date('2026-12-30T10:00:00Z'), day)
        self.assertIsNone(filters.to_date(''))

    def test_csv_and_markdown(self):
        self.assertEqual(filters.csv_cell('plain'), 'plain')
        self.assertEqual(filters.csv_cell('a, "b"'), '"a, ""b"""')
        self.assertEqual(filters.csv_row(['x', 1, None, 'y,z']), 'x,1,,"y,z"')
        self.assertEqual(filters.md_cell('a|b\nc'), 'a\\|b c')

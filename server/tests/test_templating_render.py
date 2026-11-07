import datetime
from decimal import Decimal
import threading
import time

from django.test import TestCase

from camphoric import models
from camphoric.templating import filters
from camphoric.templating.contexts import report_context
from camphoric.templating.graph import build_event_graph
from camphoric.templating.render import RenderLimits, render_template
from camphoric.templating.values import freeze

from tests.factories import create_template_event


class RenderTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()

    def setUp(self):
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

    def test_printed_methods_are_warnings(self):
        result = self.render('{{ event.start.isoformat }}\n{{ event.start.isoformat() }}')
        [warning] = result.diagnostics
        self.assertEqual(warning.severity, 'warning')
        self.assertEqual(warning.message,
                         "'isoformat' is a method, so it printed as text — call it: isoformat()")
        self.assertEqual(warning.line, 1)
        self.assertEqual(warning.column, len('{{ event.start.') + 1)

    def test_keys_hidden_by_dict_methods_are_warnings(self):
        context = {'answers': freeze({'items': 'Tent, stove'})}
        result = render_template("{{ answers.items }}\n{{ answers['items'] }}", context)
        [warning] = result.diagnostics
        self.assertEqual(warning.message, "'items' here is the dict method, not the key 'items' "
                                          "— write ['items'] to get its value")
        self.assertEqual(warning.line, 1)
        self.assertTrue(result.output.endswith('\nTent, stove'))

    def test_builtin_methods_work(self):
        result = self.render(
            "{{ campers[0].registration.registrant_email.split('@') | last }} "
            "{{ campers[0].attributes.get('nope', '–') }} "
            "{{ campers[0].registration.balance.copy_abs() | money }}")
        self.assertEqual(self.errors(result), [])
        self.assertTrue(result.output.startswith('example.com – $'), result.output)

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
        self.assertEqual(models.Registration.objects.count(), 2)

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
            limits=RenderLimits(timeout_s=0.05, max_output_chars=100))
        [error] = self.errors(result)
        self.assertEqual(error.kind, 'timeout')

    def test_timeout_in_any_thread(self):
        # Under ASGI a view's render runs off the main thread (DR-111).
        results = []
        worker = threading.Thread(daemon=True, target=lambda: results.append(self.render(
            '{% for i in range(100000) %}{% for j in range(100000) %}{% endfor %}{% endfor %}',
            limits=RenderLimits(timeout_s=0.05, max_output_chars=100))))
        worker.start()
        worker.join(10)
        self.assertFalse(worker.is_alive(), 'the render ran on past its limit')
        [error] = self.errors(results[0])
        self.assertEqual(error.kind, 'timeout')

    def test_timeout_of_any_busy_loop(self):
        # Loops over a bound list, doing what checks nothing else: compare, join, negate.
        for body in ('{% if i > j %}{% endif %}', '{% set s = "a" ~ "b" %}',
                     '{% set s = -i %}', '{% set s = i | abs %}', ''):
            result = self.render(
                '{% set r = range(100000) %}{% for i in r %}{% for j in r %}'
                + body + '{% endfor %}{% endfor %}',
                limits=RenderLimits(timeout_s=0.05, max_output_chars=100))
            [error] = self.errors(result)
            self.assertEqual(error.kind, 'timeout', body)

    def test_timeout_of_a_macro(self):
        result = self.render(
            '{% macro spin() %}{% for i in range(100000) %}{% for j in range(100000) %}'
            '{% endfor %}{% endfor %}{% endmacro %}{{ spin() }}',
            limits=RenderLimits(timeout_s=0.05, max_output_chars=100))
        [error] = self.errors(result)
        self.assertEqual(error.kind, 'timeout')

    def test_timeout_of_recursion_without_loops(self):
        for template in (
            '{% macro f(n) %}{% if n > 0 %}{{ f(n-1) }}{{ f(n-1) }}{% endif %}{% endmacro %}'
            '{{ f(40) }}',
            '{% macro f(n) %}{{ n > 0 and (f(n-1) ~ f(n-1)) }}{% endmacro %}{{ f(40) }}',
        ):
            result = self.render(
                template, limits=RenderLimits(timeout_s=0.05, max_output_chars=100))
            [error] = self.errors(result)
            self.assertEqual(error.kind, 'timeout', template)

    def test_timeout_inside_a_filter(self):
        result = self.render(
            '{% set r = range(100000) | list %}{{ r | select("in", r) | list | length }}',
            limits=RenderLimits(timeout_s=0.05, max_output_chars=100))
        [error] = self.errors(result)
        self.assertEqual(error.kind, 'timeout')

    def test_no_limit_is_left_behind(self):
        self.render('{{ 1 + 1 }}', limits=RenderLimits(timeout_s=0.01, max_output_chars=100))
        time.sleep(0.02)
        self.assertEqual(render_template('{{ 2 + 2 }}', {}).output, '4')

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


class EventDataTypoTests(TestCase):
    '''Keys an event's own data doesn't define (#994): warned, unlike unanswered ones.'''

    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()

    def render(self, source):
        return render_template(source, report_context(build_event_graph(self.made.event)))

    def assertTypo(self, source, message, column):
        result = self.render(source)
        self.assertEqual(result.output.strip(), '')
        [warning] = result.diagnostics
        self.assertEqual((warning.severity, warning.kind), ('warning', 'undefined'))
        self.assertEqual(warning.message, message)
        self.assertEqual((warning.line, warning.column), (1, column))

    def assertNoTypo(self, source):
        self.assertEqual(self.render(source).diagnostics, [], source)

    def test_pricing_lines(self):
        self.assertTypo('{{ campers[0].pricing.badge }}',
                        "camper.pricing has no field 'badge'", len('{{ campers[0].pricing.') + 1)
        self.assertTypo("{{ registrations[0].pricing['donaton'] }}",
                        "registration.pricing has no field 'donaton'",
                        len('{{ registrations[0].pricing') + 1)
        self.assertTypo('{{ incomplete_registrations[0].campers[0].pricing.tution }}',
                        "camper.pricing has no field 'tution'",
                        len('{{ incomplete_registrations[0].campers[0].pricing.') + 1)

    def test_pricing_lines_the_server_adds(self):
        # Not in this event's logic, but the server adds them (a promo code,
        # the total, a registrar's overrides), so they aren't typos.
        for source in ('{{ campers[0].pricing.promo }}{{ campers[0].pricing.overridden }}',
                       '{{ registrations[0].pricing.promo }}{{ registrations[0].pricing.total }}'
                       '{{ registrations[0].pricing.overridden }}',
                       # A camper line is summed on the registration.
                       '{{ registrations[0].pricing.tuition }}'):
            self.assertNoTypo(source)

    def test_event_pricing_variables(self):
        self.assertTypo('{{ event.pricing.adult_ful }}',
                        "event.pricing has no field 'adult_ful'", len('{{ event.pricing.') + 1)
        self.assertNoTypo('{{ event.pricing.adult }}')

    def test_form_questions(self):
        self.assertTypo('{{ campers[0].attributes.frist_name }}',
                        "camper.attributes has no field 'frist_name'",
                        len('{{ campers[0].attributes.') + 1)
        self.assertTypo('{{ registrations[0].attributes.coments }}',
                        "registration.attributes has no field 'coments'",
                        len('{{ registrations[0].attributes.') + 1)
        self.assertTypo('{{ campers[0].attributes.emergency_contact.phon }}',
                        "camper.attributes.emergency_contact has no field 'phon'",
                        len('{{ campers[0].attributes.emergency_contact.') + 1)

    def test_unanswered_questions_are_not_typos(self):
        for source in (
            '{{ campers[1].attributes.linens }}',
            # Only asked when driving, in a dependency's branch.
            '{{ campers[0].attributes.license_plate }}',
            # Only the staff registration type asks it.
            '{{ registrations[0].attributes.staff_role }}',
            '{{ registrations[0].attributes.address.city }}{{ campers[0].attributes.email }}',
            # Kept out of the answers by the registration flow.
            '{{ registrations[0].attributes.registrant_email }}',
        ):
            self.assertNoTypo(source)

    def test_admin_attributes(self):
        self.assertTypo('{{ campers[0].admin_attributes.meal_assignment }}',
                        "camper.admin_attributes has no field 'meal_assignment'",
                        len('{{ campers[0].admin_attributes.') + 1)
        self.assertNoTypo('{{ campers[1].admin_attributes.checked_in }}')

    def test_a_form_without_listed_questions_is_not_checked(self):
        # No registration admin schema, a payment schema that allows any key,
        # and a free-form object: nothing to check them against.
        self.made.event.payment_schema = {
            'type': 'object', 'properties': {'check_number': {'type': 'string'}},
            'additionalProperties': True}
        camper_schema = {**self.made.event.camper_schema}
        camper_schema['properties'] = {**camper_schema['properties'], 'extras': {'type': 'object'}}
        self.made.event.camper_schema = camper_schema
        self.made.event.save()
        models.Payment.objects.filter(registration=self.made.r1).update(
            attributes={'check_number': '101'})
        models.Camper.objects.filter(id=self.made.c1.id).update(
            attributes={**self.made.c1.attributes, 'extras': {'tent': 'blue'}})
        self.assertNoTypo('{{ registrations[0].admin_attributes.anything }}'
                          '{{ payments[0].attributes.memo }}'
                          '{{ campers[0].attributes.extras.anything }}')

    def set_camper(self, *, schema=None, **answers):
        if schema is not None:
            self.made.event.camper_schema = schema
            self.made.event.save()
        models.Camper.objects.filter(id=self.made.c1.id).update(
            attributes={**self.made.c1.attributes, **answers})

    def test_a_registration_type_may_add_to_an_object(self):
        # Merged deeply, as registering merges it: emergency_contact gains a question.
        self.made.staff.camper_schema_overrides = {'properties': {'emergency_contact': {
            'properties': {'relationship': {'type': 'string'}}}}}
        self.made.staff.save()
        self.assertNoTypo('{{ campers[0].attributes.emergency_contact.relationship }}')
        self.assertTypo('{{ campers[0].attributes.emergency_contact.relationshp }}',
                        "camper.attributes.emergency_contact has no field 'relationshp'",
                        len('{{ campers[0].attributes.emergency_contact.') + 1)

    def test_an_object_has_every_branch_s_questions(self):
        schema = {**self.made.event.camper_schema, 'dependencies': {'driving': {'oneOf': [
            {'properties': {'driving': {'enum': ['Passenger']},
                            'ride': {'type': 'object', 'properties': {'pickup': {}}}}},
            {'properties': {'driving': {'enum': ['Driver']},
                            'ride': {'type': 'object', 'properties': {'seats': {}}}}},
        ]}}}
        self.set_camper(schema=schema, driving='Driver', ride={'seats': 3})
        self.assertNoTypo('{{ campers[0].attributes.ride.pickup }}')
        self.assertTypo('{{ campers[0].attributes.ride.seat }}',
                        "camper.attributes.ride has no field 'seat'",
                        len('{{ campers[0].attributes.ride.') + 1)

    def test_a_branch_may_allow_other_keys(self):
        self.set_camper(schema={**self.made.event.camper_schema,
                                'allOf': [{'additionalProperties': True}]})
        self.assertNoTypo('{{ campers[0].attributes.anything }}')

    def test_an_answer_named_like_the_type_tag_is_the_answer(self):
        self.set_camper(dict_type='hello')
        result = self.render('{{ campers[0].attributes.dict_type }}')
        self.assertEqual((result.output, result.diagnostics), ('hello', []))

    def test_each_is_warned_once_per_line(self):
        result = self.render('{% for c in campers %}{{ c.pricing.badge }}{% endfor %}\n'
                             '{{ campers[0].pricing.badge }}')
        self.assertEqual([(d.line, d.message) for d in result.diagnostics],
                         [(1, "camper.pricing has no field 'badge'"),
                          (2, "camper.pricing has no field 'badge'")])

    def test_using_one_in_arithmetic_names_it(self):
        result = self.render('{{ campers[0].pricing.badge + 1 }}')
        error = next(d for d in result.diagnostics if d.severity == 'error')
        self.assertEqual(error.message, "camper.pricing has no field 'badge'")

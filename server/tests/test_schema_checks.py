'''
An event's forms and pricing are checked for the gaps JSON Schema doesn't
catch (SPEC DR-106, #771): a default that isn't one of its choices, and a text
or choice answer the pricing reads that a registration may lack.
'''

from django.contrib.auth.models import User
from django.test import SimpleTestCase
from rest_framework.test import APITestCase

from camphoric import models, schema_checks

AGES = ['31-79 years old', '80+ years old', '3-12 years old']


def camper_schema(required=(), default=None):
    age = {'type': 'string', 'enum': AGES}
    if default is not None:
        age['default'] = default
    return {
        'type': 'object',
        'required': list(required),
        'properties': {
            'age': age,
            'linens': {'type': 'boolean'},
            'nights': {'type': 'integer'},
            'parking_passes': {'type': 'array', 'items': {'type': 'string'}},
        },
    }


def adult_rate(age_var):
    '''Camper pricing whose rate depends on the age, as Camp Harmony's does.'''
    return [
        {'var': 'rate', 'exp': {'if': [
            {'===': ['31-79 years old', age_var]}, 500,
            {'===': ['3-12 years old', age_var]}, 200,
            0]}},
        {'var': 'total', 'exp': {'var': 'rate'}},
    ]


def problems(camper, camper_logic):
    return schema_checks.pricing_input_problems(
        {}, camper, [{'var': 'total', 'exp': 0}], camper_logic)


class DefaultProblemsTests(SimpleTestCase):
    def test_a_default_among_the_choices_is_fine(self):
        schema = camper_schema(default='80+ years old')
        self.assertEqual(schema_checks.default_problems(schema), [])

    def test_a_default_that_isnt_a_choice(self):
        # Camp Harmony's renamed brackets left "70+" behind (#771).
        self.assertEqual(
            schema_checks.default_problems(camper_schema(default='70+ years old'), 'camper_schema'),
            ['camper_schema.properties.age: the default "70+ years old" is not one of its choices'])

    def test_choices_as_one_of_consts_and_list_items(self):
        schema = {'properties': {
            'option': {'oneOf': [{'const': 'Full'}, {'const': 'Deposit'}], 'default': 'Half'},
            'days': {'type': 'array', 'items': {'enum': ['Mon', 'Tue']}, 'default': ['Mon', 'Sun']},
        }}
        self.assertEqual(schema_checks.default_problems(schema, 's'), [
            's.properties.option: the default "Half" is not one of its choices',
            's.properties.days: the default "Sun" is not one of its choices',
        ])


class PricingInputProblemsTests(SimpleTestCase):
    def test_a_required_answer_is_fine(self):
        logic = adult_rate({'var': 'camper.age'})
        self.assertEqual(problems(camper_schema(required=['age']), logic), {})

    def test_an_optional_answer_read_without_a_fallback(self):
        found = problems(camper_schema(), adult_rate({'var': 'camper.age'}))
        self.assertEqual(list(found), ['camper_pricing_logic'])
        self.assertIn('camper.age: the pricing reads it', found['camper_pricing_logic'][0])

    def test_a_fallback_that_is_a_choice_is_fine(self):
        logic = adult_rate({'var': ['camper.age', '31-79 years old']})
        self.assertEqual(problems(camper_schema(), logic), {})

    def test_a_fallback_that_isnt_a_choice(self):
        # Camp Harmony's fallback was the list of adult ages: `===` never matches it (#771).
        logic = adult_rate({'var': ['camper.age', ['31-79 years old', '80+ years old']]})
        found = problems(camper_schema(required=['age']), logic)
        self.assertEqual(found, {'camper_pricing_logic': [
            'camper.age: its fallback ["31-79 years old", "80+ years old"] is not one of its '
            'choices, so a camper without one matches nothing.']})

    def test_an_or_with_a_constant_is_a_fallback(self):
        logic = adult_rate({'or': [{'var': 'camper.age'}, '31-79 years old']})
        self.assertEqual(problems(camper_schema(), logic), {})

    def test_an_or_fallback_must_be_a_choice_too(self):
        logic = adult_rate({'or': [{'var': 'camper.age'}, ['31-79 years old', '80+ years old']]})
        found = problems(camper_schema(required=['age']), logic)
        self.assertIn('its fallback', found['camper_pricing_logic'][0])

    def test_an_or_of_comparisons_is_no_fallback(self):
        logic = [{'var': 'total', 'exp': {'if': [
            {'or': [{'===': ['31-79 years old', {'var': 'camper.age'}]}, False]}, 500, 0]}}]
        self.assertIn('camper_pricing_logic', problems(camper_schema(), logic))

    def test_a_check_guards_only_the_branch_it_leads_to(self):
        guarded = {'if': [{'var': 'camper.age'}, {'var': 'camper.age'}, 0]}
        unguarded = {'===': ['3-12 years old', {'var': 'camper.age'}]}
        logic = [{'var': 'x', 'exp': guarded}, {'var': 'total', 'exp': unguarded}]
        self.assertIn('camper_pricing_logic', problems(camper_schema(), logic))
        else_branch = [{'var': 'total', 'exp': {'if': [{'var': 'camper.age'}, 0, unguarded]}}]
        self.assertIn('camper_pricing_logic', problems(camper_schema(), else_branch))

    def test_a_check_on_a_part_doesnt_guard_the_whole(self):
        logic = [{'var': 'total', 'exp': {'if': [
            {'var': 'camper.age.x'}, {'===': ['3-12 years old', {'var': 'camper.age'}]}, 0]}}]
        self.assertIn('camper_pricing_logic', problems(camper_schema(), logic))

    def test_double_negation_and_missing_are_checks(self):
        rate = {'===': ['3-12 years old', {'var': 'camper.age'}]}
        for exp in ({'if': [{'!!': {'var': 'camper.age'}}, rate, 500]},
                    {'if': [{'!!': [{'var': 'camper.age'}]}, rate, 500]},
                    {'if': [{'missing': ['camper.age']}, 500, rate]}):
            with self.subTest(exp=exp):
                self.assertEqual(problems(camper_schema(), [{'var': 'total', 'exp': exp}]), {})

    def test_a_field_defined_by_ref(self):
        schema = {'definitions': {'age': {'type': 'string', 'enum': AGES}},
                  'properties': {'age': {'$ref': '#/definitions/age'}}}
        self.assertIn('camper_pricing_logic', problems(schema, adult_rate({'var': 'camper.age'})))

    def test_an_answer_the_logic_checks_for_first_is_fine(self):
        # Family Week prices a camper without a birthdate as an adult.
        logic = [{'var': 'total', 'exp': {'if': [
            {'var': 'camper.age'},
            {'if': [{'===': ['3-12 years old', {'var': 'camper.age'}]}, 200, 500]},
            500]}}]
        self.assertEqual(problems(camper_schema(), logic), {})

    def test_numbers_lists_and_checkboxes_mean_none_when_missing(self):
        logic = [{'var': 'total', 'exp': {'+': [
            {'var': 'camper.nights'}, {'var': 'camper.linens'}, {'var': 'camper.parking_passes'}]}}]
        self.assertEqual(problems(camper_schema(), logic), {})

    def test_even_with_choices(self):
        schema = {'properties': {'linens': {'type': 'boolean', 'enum': [True, False]},
                                 'nights': {'type': 'integer', 'enum': [1, 2, 3]}}}
        logic = [{'var': 'total',
                  'exp': {'+': [{'var': 'camper.linens'}, {'var': 'camper.nights'}]}}]
        self.assertEqual(problems(schema, logic), {})

    def test_other_variables_are_left_alone(self):
        logic = [{'var': 'total', 'exp': {'+': [
            {'var': 'pricing.fee'}, {'var': 'registration.created_at.epoch'},
            {'var': 'camper.lodging.lodging_requested.choices'}, {'var': 'rate'}]}}]
        self.assertEqual(problems(camper_schema(), logic), {})


class EventSaveTests(APITestCase):
    '''Saving an event's forms or pricing runs the checks; other edits don't.'''

    def setUp(self):
        self.client.force_authenticate(
            User.objects.create_superuser('tom', 'tom@example.com', 'password'))
        organization = models.Organization.objects.create(name='Org')
        self.event = models.Event.objects.create(
            organization=organization, name='Camp',
            camper_schema=camper_schema(required=['age']),
            camper_pricing_logic=adult_rate({'var': 'camper.age'}),
            registration_pricing_logic=[{'var': 'total', 'exp': 0}])

    def patch(self, **data):
        return self.client.patch(f'/api/events/{self.event.id}/', data, format='json')

    def test_a_schema_with_a_default_that_isnt_a_choice_is_refused(self):
        schema = camper_schema(required=['age'], default='70+ years old')
        response = self.patch(camper_schema=schema)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('is not one of its choices', str(response.data['camper_schema']))

    def test_making_a_priced_answer_optional_is_refused(self):
        response = self.patch(camper_schema=camper_schema())
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('camper.age: the pricing reads it',
                      str(response.data['camper_pricing_logic']))

    def test_pricing_that_reads_an_optional_answer_is_refused(self):
        models.Event.objects.filter(pk=self.event.pk).update(
            camper_schema=camper_schema(), camper_pricing_logic=[{'var': 'total', 'exp': 0}])
        response = self.patch(camper_pricing_logic=adult_rate({'var': 'camper.age'}))
        self.assertEqual(response.status_code, 400, response.data)

    def test_a_fixed_event_saves(self):
        logic = adult_rate({'var': ['camper.age', '31-79 years old']})
        response = self.patch(camper_schema=camper_schema(), camper_pricing_logic=logic)
        self.assertEqual(response.status_code, 200, response.data)

    def test_other_edits_arent_blocked_by_an_existing_gap(self):
        models.Event.objects.filter(pk=self.event.pk).update(camper_schema=camper_schema())
        for data in ({'name': 'Camp 2027'},
                     {'registration_schema': {'type': 'object', 'title': 'Camp 2027'}}):
            with self.subTest(data=data):
                response = self.patch(**data)
                self.assertEqual(response.status_code, 200, response.data)

    def test_a_fix_can_come_one_field_at_a_time(self):
        # As Camp Harmony was (#771), and as its import re-sends it: the schema
        # (age now required) arrives before the pricing that fixes the fallback.
        broken = adult_rate({'var': ['camper.age', ['31-79 years old', '80+ years old']]})
        models.Event.objects.filter(pk=self.event.pk).update(
            camper_schema=camper_schema(default='70+ years old'), camper_pricing_logic=broken)
        schema = camper_schema(required=['age'], default='70+ years old')
        response = self.patch(camper_schema=schema)
        self.assertEqual(response.status_code, 200, response.data)
        response = self.patch(camper_pricing_logic=adult_rate({'var': 'camper.age'}))
        self.assertEqual(response.status_code, 200, response.data)
        schema = camper_schema(required=['age'], default='80+ years old')
        response = self.patch(camper_schema=schema)
        self.assertEqual(response.status_code, 200, response.data)

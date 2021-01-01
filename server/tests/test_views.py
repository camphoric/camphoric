import datetime
import json

from django.core import mail
from django.utils import timezone
import jsonschema  # Using Draft-7
from rest_framework.test import APITestCase

from camphoric import models


class RegisterGetTests(APITestCase):
    def setUp(self):
        self.organization = models.Organization.objects.create(name='Test Organization')

    def test_dataSchema(self):
        event = models.Event.objects.create(
            organization=self.organization,
            name='Test Data Event',
            registration_schema={
                'type': 'object',
                'properties': {
                    'billing_name': {'type': 'string'},
                    'billing_address': {'type': 'string'},
                },
            },

            camper_schema={
                'type': 'object',
                'properties': {
                    'name': {'type': 'string'},
                },
            },
        )

        response = self.client.get(f'/api/events/{event.id}/register')
        self.assertEqual(response.status_code, 200)
        jsonschema.Draft7Validator.check_schema(response.data['dataSchema'])
        self.assertEqual(response.data['dataSchema'], {
            'type': 'object',
            'definitions': {
                'camper': {
                    'type': 'object',
                    'properties': {
                        'name': {'type': 'string'},
                    },

                },
            },
            'required': ['registrant_email'],
            'properties': {
                'registrant_email': {
                    'type': 'string',
                    'format': 'email',
                    'title': 'Registrant email',
                },
                'campers': {
                    'type': 'array',
                    'minItems': 1,
                    'items': {
                        '$ref': '#/definitions/camper',
                    },
                },
                'billing_name': {'type': 'string'},
                'billing_address': {'type': 'string'},
            },
        })

    def test_uiSchema(self):
        event = models.Event.objects.create(
            organization=self.organization,
            name='Test uiSchema Event',
            registration_ui_schema={
                'ui:title': 'Test UI Schema',
                'ui:description': 'Test Description',
            }
        )
        response = self.client.get(f'/api/events/{event.id}/register')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['uiSchema'], {
            'ui:title': 'Test UI Schema',
            'ui:description': 'Test Description',
        })

    def test_pricing_fields(self):
        event = models.Event.objects.create(
            organization=self.organization,
            name='Test Price Fields',
            start=datetime.datetime(2019, 2, 25, 17, 0, 5, tzinfo=timezone.utc),
            pricing={
                'adult': 790,
                'teen': 680,
            },
            camper_pricing_logic=[
                {
                    'var': 'tuition',
                    'exp': {'+': [1, 2]},
                },
                {
                    'var': 'meals',
                    'exp': {'*': [2, 3]},
                },
                {
                    'var': 'total',
                    'exp': {'+': [{'var': 'tuition'}, {'var': 'meals'}]},
                },

            ],
            registration_pricing_logic=[
                {
                    'var': 'donation',
                    'exp': {'var': 'registration.donation'},
                },
                {
                    'var': 'total',
                    'exp': {'var': 'donation'},
                },
            ],
        )
        response = self.client.get(f'/api/events/{event.id}/register')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['pricing'], event.pricing)
        self.assertEqual(response.data['pricingLogic'], {
            'camper': event.camper_pricing_logic,
            'registration': event.registration_pricing_logic,
        })
        self.assertEqual(response.data['event'], {'start': {'day': 25, 'month': 2, 'year': 2019}})


class RegisterPostTests(APITestCase):

    def setUp(self):
        self.organization = models.Organization.objects.create(name='Test Organization')
        self.event = models.Event.objects.create(
            organization=self.organization,
            name='Test Data Event',
            registration_schema={
                'type': 'object',
                'required': ['billing_name', 'billing_address'],
                'properties': {
                    'billing_name': {'type': 'string'},
                    'billing_address': {'type': 'string'},
                },
            },

            camper_schema={
                'type': 'object',
                'required': ['name'],
                'properties': {
                    'name': {'type': 'string'},
                },
            },
            pricing={},
            registration_pricing_logic=[
                {
                    'var': 'cabins',
                    'exp': {'*': [1, 100]},
                },
                {
                    'var': 'total',
                    'exp': {'var': 'cabins'},
                },
            ],
            camper_pricing_logic=[
                {
                    'var': 'tuition',
                    'exp': {'*': [1, 100]},
                },
                {
                    'var': 'total',
                    'exp': {'var': 'tuition'},
                },
            ],
            confirmation_page_template=[],
            confirmation_email_subject='Registration confirmation',
            confirmation_email_template=[
                'Thanks for registering, ',
                {'var': 'registration.billing_name'},
                '!\n\nCampers:\n',
                {'map': [{'var': 'campers'}, [{'var': 'name'}, '\n']]},
                '\nTotal due: $',
                {'var': 'pricing_results.total'},
                '\n'
            ],
            confirmation_email_from='reg@camp.org',
        )
        self.valid_form_data = {
            'registrant_email': 'testi@mctesterson.com',
            'campers': [
                {'name': 'Testi McTesterton'},
                {'name': 'Testi McTesterton Junior'},
            ],
            'billing_name': 'Testi McTesterton',
            'billing_address': '1234 Average Street',
        }

    def test_post_errors(self):
        response = self.client.post('/api/events/0/register', {}, format='json')
        self.assertEqual(response.status_code, 404)

        response = self.client.post(f'/api/events/{self.event.id}/register', {}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertRegex(json.dumps(response.data), r'formData.*required', )

        response = self.client.post(
            f'/api/events/{self.event.id}/register',
            {'formData': {}},
            format='json')
        self.assertEqual(response.status_code, 400)
        self.assertRegex(json.dumps(response.data), r'pricingResults.*required')

        response = self.client.post(
            f'/api/events/{self.event.id}/register',
            {
                'formData': {**self.valid_form_data, 'billing_name': 2},
                'pricingResults': {},
            },

            format='json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertRegex(json.dumps(response.data), r'billing_name')

    def test_post_success(self):
        self.assertEqual(models.Registration.objects.count(), 0)
        expected_pricing_results = {
            'cabins': 100,
            'tuition': 200,
            'campers': [
                {'total': 100, 'tuition': 100},
                {'total': 100, 'tuition': 100},
            ],
            'total': 300,
        }
        response = self.client.post(
            f'/api/events/{self.event.id}/register',
            {
                'formData': self.valid_form_data,
                'pricingResults': expected_pricing_results,
            },
            format='json'
        )
        self.assertEqual(response.status_code, 200)
        registrations = models.Registration.objects.all()
        registration = registrations[0]
        campers = registration.campers.all()
        self.assertEqual(registration.attributes['billing_name'], 'Testi McTesterton')
        self.assertEqual(registration.attributes['billing_address'], '1234 Average Street')
        self.assertEqual(registration.event, self.event)
        self.assertEqual(len(campers), 2)
        self.assertEqual(campers[0].attributes['name'], 'Testi McTesterton')
        self.assertEqual(campers[1].attributes['name'], 'Testi McTesterton Junior')
        self.assertEqual(campers[0].registration, registration)
        self.assertEqual(campers[1].registration, registration)
        self.assertEqual(registration.server_pricing_results, expected_pricing_results)
        self.assertEqual(registration.client_reported_pricing, expected_pricing_results)

        self.assertEqual(response.data, {
            'emailError': False,
            'serverPricingPesults': expected_pricing_results,
        })

        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.subject, 'Registration confirmation')
        self.assertEqual(message.body, """
Thanks for registering, Testi McTesterton!

Campers:
Testi McTesterton
Testi McTesterton Junior

Total due: $300
""".lstrip())
        self.assertEqual(message.from_email, 'reg@camp.org')
        self.assertEqual(message.to, ['testi@mctesterson.com'])

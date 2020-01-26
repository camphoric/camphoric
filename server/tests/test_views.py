from rest_framework.test import APITestCase
from rest_framework.serializers import ValidationError

from camphoric import models, views


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
            'properties': {
                'campers': {
                    'type': 'array',
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
            pricing={
                'adult': 790,
                'teen': 680,
            },
            camper_pricing_logic={
                'tuition': {'+': [1, 2]},
                'meals': {'*': [2, 3]}
            },
            registration_pricing_logic={
                'donation': {'var': 'registration.donation'}
            },
        )
        response = self.client.get(f'/api/events/{event.id}/register')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['pricing'], event.pricing)
        self.assertEqual(response.data['pricingLogic'], {
            'camper': event.camper_pricing_logic,
            'registration': event.registration_pricing_logic,
        })


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
        )
        self.valid_form_data = {
            'campers': [
                {'name': 'Testi McTesterton'},
                {'name': 'Testi McTesterton Junior'},
            ],
            'billing_name': 'Testi McTesterton',
            'billing_address': '1234 Average Street',
        }

    def test_validate_form_data_invalid(self):
        with self.assertRaisesRegex(ValidationError, 'billing_name'):
            views.RegisterView.validate_form_data(self.event, {
                **self.valid_form_data, 'billing_name': 2})

    def test_validate_form_data_valid(self):
        views.RegisterView.validate_form_data(self.event, self.valid_form_data)

    def test_deserialize_form_data(self):
        registration, campers = views.RegisterView.deserialize_form_data(
            self.event, self.valid_form_data)
        self.assertIsInstance(registration, models.Registration)
        self.assertEqual(registration.attributes['billing_name'], 'Testi McTesterton')
        self.assertEqual(registration.attributes['billing_address'], '1234 Average Street')
        self.assertEqual(registration.event, self.event)
        self.assertIsInstance(campers, list)
        self.assertEqual(len(campers), 2)
        self.assertIsInstance(campers[0], models.Camper)
        self.assertIsInstance(campers[1], models.Camper)
        self.assertEqual(campers[0].attributes['name'], 'Testi McTesterton')
        self.assertEqual(campers[1].attributes['name'], 'Testi McTesterton Junior')
        self.assertEqual(campers[0].registration, registration)
        self.assertEqual(campers[1].registration, registration)



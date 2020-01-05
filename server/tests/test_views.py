from rest_framework.test import APITestCase

from camphoric import models

class RegisterTests(APITestCase):
    def setUp(self):
        self.organization = models.Organization.objects.create(name="Test Organization")

    def test_dataSchema(self):
        event = models.Event.objects.create(
            organization=self.organization,
            name="Test Data Event",
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
        self.assertEqual(response.data, {"dataSchema": {
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
        }})

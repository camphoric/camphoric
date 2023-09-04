from rest_framework.test import APITestCase

import json
from django.core import serializers
from django.conf import settings
from camphoric.test.mock_server import MockServer
from camphoric import (
    templates,
    models,
)
from tests import utils


class TemplateTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        cls.paypal_server = MockServer()
        cls.paypal_server.start()
        settings.PAYPAL_BASE_URL = f'http://{cls.paypal_server.host}:{cls.paypal_server.port}'
        settings.PAYPAL_CLIENT_ID = 'test-client-id'
        settings.PAYPAL_SECRET = 'test-secret'

    @classmethod
    def tearDownClass(cls):
        cls.paypal_server.stop()

    def setUp(self):
        utils.create_standard_test_event(self)
        utils.create_registration(self)

    def test_create_ok(self):
        response = self.client.get(f'/api/events/{self.event.id}/register')
        self.assertEqual(response.status_code, 200)

    def test_template_vars(self):
        values = templates.get_template_vars(self.event.id)
        self.assertEqual(values['event'].id, self.event.id)

        result = templates.render_jinja_template('{{ event.id }}', values)
        self.assertEqual(result['error'], None)
        self.assertEqual(result['report'], str(self.event.id))

        result = templates.render_jinja_template('{{ campers[0].id }}', values)
        self.assertEqual(result['error'], None)
        self.assertEqual(result['report'], str(self.campers[0].id))

        result = templates.render_jinja_template('{{ campers[0].registration.id }}', values)
        self.assertEqual(result['error'], None)
        self.assertEqual(result['report'], str(self.registration.id))

        tplt = '{% for camper in campers %}{{ camper.attributes.name }};; {% endfor %}'
        result = templates.render_jinja_template(tplt, values)
        self.assertEqual(result['error'], None)
        self.assertEqual(result['report'], 'Testi McTesterton;; Testi McTesterton Junior;; ')

    def test_sandbox(self):
        values = templates.get_template_vars(self.event.id)
        campers_before = serializers.serialize(
            'json',
            models.Camper.objects.filter(registration=self.registration.id)
        )

        templates.render_jinja_template('{{ campers[0].delete() }}', values)

        campers_after = serializers.serialize(
            'json',
            models.Camper.objects.filter(registration=self.registration.id)
        )
        # it should not delete the model in reality
        self.assertEqual(campers_before, campers_after)

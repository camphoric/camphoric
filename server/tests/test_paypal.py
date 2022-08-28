import json
import os.path
import unittest

from camphoric.paypal import PayPalClient
from camphoric.test.mock_server import MockServer


class PayPalClientTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = MockServer()
        cls.server.start()
        cls.base_url = f'http://{cls.server.host}:{cls.server.port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.stop()

    def setUp(self):
        self.server.reset()

        with open(os.path.join(
            os.path.dirname(__file__),
            'data',
            'paypal_sample_order_details_response.json'
        )) as f:
            self.order_details_response = json.load(f)

    def test_fetch_order_details(self):
        client = PayPalClient(self.base_url, client_id='123', secret='abc')
        self.server.add_mock_response(200, {}, json=self.order_details_response)
        details = client.fetch_order_details('fake-order-id')

        self.assertEqual(len(self.server.requests), 1)
        request = self.server.requests[0]
        self.assertEqual(request['path_query'], '/v2/checkout/orders/fake-order-id')
        self.assertEqual(request['headers']['Content-Type'], 'application/json')
        self.assertRegex(request['headers']['Authorization'], r'^Basic .+')

        self.assertEqual(details, self.order_details_response)

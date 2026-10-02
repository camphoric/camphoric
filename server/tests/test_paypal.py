import json
import os.path
import unittest

from camphoric.paypal import PayPalClient, PayPalError
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

    def test_create_capture_and_refund_send_request_ids(self):
        client = PayPalClient(self.base_url, client_id='123', secret='abc')
        self.server.add_mock_response(201, {}, json={'id': 'ORDER'})
        self.server.add_mock_response(201, {}, json={'id': 'ORDER', 'status': 'COMPLETED'})
        self.server.add_mock_response(201, {}, json={'id': 'REFUND', 'status': 'COMPLETED'})

        self.assertEqual(client.create_order({'intent': 'CAPTURE'}, 'create-1'), {'id': 'ORDER'})
        client.capture_order('ORDER', 'capture-ORDER')
        client.refund_capture('CAPTURE', '10.00', 'Sorry', 'refund-1')

        create, capture, refund = self.server.requests
        self.assertEqual((create['method'], create['path_query']), ('POST', '/v2/checkout/orders'))
        self.assertEqual(create['json'], {'intent': 'CAPTURE'})
        self.assertEqual(create['headers']['PayPal-Request-Id'], 'create-1')
        self.assertEqual(capture['path_query'], '/v2/checkout/orders/ORDER/capture')
        self.assertEqual(capture['headers']['PayPal-Request-Id'], 'capture-ORDER')
        self.assertEqual(refund['path_query'], '/v2/payments/captures/CAPTURE/refund')
        self.assertEqual(refund['json'], {'amount': {'value': '10.00', 'currency_code': 'USD'},
                                          'note_to_payer': 'Sorry'})

    def test_errors_say_whether_money_may_have_moved(self):
        client = PayPalClient(self.base_url, client_id='123', secret='abc')
        self.server.add_mock_response(422, {}, json={
            'message': 'Declined', 'details': [{'issue': 'INSTRUMENT_DECLINED'}]})
        with self.assertRaises(PayPalError) as refused:
            client.capture_order('ORDER', 'capture-ORDER')
        error = refused.exception
        self.assertEqual((error.unknown, error.issue, str(error)),
                         (False, 'INSTRUMENT_DECLINED', 'Declined'))

        self.server.add_mock_response(503, {}, json={})
        with self.assertRaises(PayPalError) as unknown:
            client.capture_order('ORDER', 'capture-ORDER')
        self.assertTrue(unknown.exception.unknown)

import unittest

import requests

from camphoric.test.mock_server import MockServer


class MockServerTests(unittest.TestCase):
    def test_basics(self):
        server = MockServer()
        server.start()

        server.add_mock_response(200, {'X-SomeResponseHeader': 'xyz'}, {'foo': 'bar'})
        r = requests.get(
            f'http://{server.host}:{server.port}/thing?n=99',
            headers={'X-SomeRequestHeader': 'abc'},
        )
        self.assertEqual(len(server.requests), 1)
        request = server.requests[0]
        self.assertEqual(request['method'], 'GET')
        self.assertEqual(request['path_query'], '/thing?n=99')
        self.assertEqual(request['headers']['X-SomeRequestHeader'], 'abc')
        self.assertEqual(request['text'], '')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers['X-SomeResponseHeader'], 'xyz')
        self.assertEqual(r.json(), {'foo': 'bar'})

        server.add_mock_response(400, {}, {'error': 'bad request, very bad request!'})
        r = requests.get(f'http://{server.host}:{server.port}/')
        self.assertEqual(len(server.requests), 2)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json(), {'error': 'bad request, very bad request!'})

        server.add_mock_response(403, {}, {})
        r = requests.post(f'http://{server.host}:{server.port}/')
        self.assertEqual(len(server.requests), 3)
        self.assertEqual(server.requests[2]['method'], 'POST')

        server.reset()
        self.assertEqual(len(server.requests), 0)

        server.stop()

'''
The ASGI app (SPEC DR-111): each worker lets CAMPHORIC_WORKER_CONCURRENCY
requests in at once and queues the rest, so database connections stay bounded;
one that waits too long for its turn is told the server is busy.
'''

import asyncio

from asgiref.testing import ApplicationCommunicator
from django.test import SimpleTestCase

from camphoric_server.asgi import application, limit_concurrency


def http(path='/'):
    return {'type': 'http', 'method': 'GET', 'path': path, 'raw_path': path.encode(),
            'query_string': b'', 'headers': [(b'host', b'localhost')], 'scheme': 'http',
            'server': ('localhost', 80), 'client': ('127.0.0.1', 1234),
            'http_version': '1.1', 'asgi': {'version': '3.0'}}


class ConcurrencyTests(SimpleTestCase):
    async def test_requests_past_the_limit_wait_their_turn(self):
        state = {'inside': 0, 'most': 0, 'done': 0}

        async def app(scope, receive, send):
            state['inside'] += 1
            state['most'] = max(state['most'], state['inside'])
            await asyncio.sleep(0.01)
            state['inside'] -= 1
            state['done'] += 1

        limited = limit_concurrency(app, 4, wait=5)
        await asyncio.gather(*(limited({'type': 'http'}, None, None) for _ in range(12)))
        self.assertEqual(state, {'inside': 0, 'most': 4, 'done': 12})

    async def test_one_kept_waiting_too_long_is_told_the_server_is_busy(self):
        stuck = asyncio.Event()

        async def app(scope, receive, send):
            await stuck.wait()

        limited = limit_concurrency(app, 1, wait=0.05)
        holder = asyncio.ensure_future(limited({'type': 'http'}, None, None))
        await asyncio.sleep(0)
        sent = []

        async def send(message):
            sent.append(message)

        await limited({'type': 'http'}, None, send)
        self.assertEqual(sent[0]['status'], 503)
        self.assertIn(b'busy', sent[1]['body'])
        stuck.set()
        await holder

    async def test_lifespan_messages_pass_straight_through(self):
        seen = []

        async def app(scope, receive, send):
            seen.append(scope['type'])

        limited = limit_concurrency(app, 1, wait=0.01)
        await asyncio.gather(*(limited({'type': 'lifespan'}, None, None) for _ in range(3)))
        self.assertEqual(seen, ['lifespan'] * 3)


class ApplicationTests(SimpleTestCase):
    async def test_the_app_answers_through_django(self):
        # The healthcheck's request, through the middleware and a view.
        communicator = ApplicationCommunicator(application, http('/api/set-csrf-cookie'))
        await communicator.send_input({'type': 'http.request', 'body': b''})
        start = await communicator.receive_output(5)
        self.assertEqual(start['status'], 200)
        cookies = [value for name, value in start['headers'] if name == b'Set-Cookie']
        self.assertTrue(any(cookie.startswith(b'csrftoken=') for cookie in cookies))

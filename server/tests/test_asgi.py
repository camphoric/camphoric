'''
The ASGI app (SPEC DR-111): each worker lets CAMPHORIC_WORKER_CONCURRENCY
requests in at once and queues the rest, so database connections stay bounded.
'''

import asyncio

from django.test import SimpleTestCase

from camphoric_server.asgi import limit_concurrency


class ConcurrencyTests(SimpleTestCase):
    async def test_requests_past_the_limit_wait_their_turn(self):
        state = {'inside': 0, 'most': 0, 'done': 0}

        async def app(scope, receive, send):
            state['inside'] += 1
            state['most'] = max(state['most'], state['inside'])
            await asyncio.sleep(0.01)
            state['inside'] -= 1
            state['done'] += 1

        limited = limit_concurrency(app, 4)
        await asyncio.gather(*(limited({'type': 'http'}, None, None) for _ in range(12)))
        self.assertEqual(state, {'inside': 0, 'most': 4, 'done': 12})

    async def test_lifespan_messages_pass_straight_through(self):
        seen = []

        async def app(scope, receive, send):
            seen.append(scope['type'])

        limited = limit_concurrency(app, 1)
        await asyncio.gather(*(limited({'type': 'lifespan'}, None, None) for _ in range(3)))
        self.assertEqual(seen, ['lifespan'] * 3)

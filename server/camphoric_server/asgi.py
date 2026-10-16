"""
ASGI config for camphoric_server: what gunicorn's uvicorn workers serve
(SPEC DR-111).

Views stay synchronous: Django runs each request's view in a thread of its
own, each with its own database connection. So each worker serves at most
CAMPHORIC_WORKER_CONCURRENCY requests at once and queues the rest, which keeps
the database's connections bounded — workers × that — however many people
press Register at the same moment. A request that waits longer than
CAMPHORIC_WORKER_QUEUE_WAIT seconds for its turn is told the server is busy
(503), rather than waiting on requests that may never finish. An event's live
change feed holds its response open for as long as an admin looks at the
event; it counts against the cap only until its response starts (signing in,
checking the event), then streams on the event loop, outside it (SPEC DR-112).

It exposes the ASGI callable as a module-level variable named ``application``.
"""

import asyncio
import os
import re

from django.conf import settings
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'camphoric_server.settings')

# Streams that stay open, and so count against the cap only until they start.
UNCAPPED = re.compile(r'^/api/events/\d+/stream/$')

BUSY = b'{"detail": "The server is busy. Please try again in a moment."}'


async def busy(send):
    await send({'type': 'http.response.start', 'status': 503, 'headers': [
        (b'content-type', b'application/json'), (b'retry-after', b'5')]})
    await send({'type': 'http.response.body', 'body': BUSY})


def limit_concurrency(app, limit, wait, uncapped=UNCAPPED):
    '''
    Let at most `limit` HTTP requests into `app` at once; the rest wait their
    turn, for up to `wait` seconds, then get a 503. A path `uncapped` matches
    gives its turn back as soon as its response starts.
    '''
    turns = asyncio.Semaphore(limit)

    async def limited(scope, receive, send):
        if scope['type'] != 'http':
            return await app(scope, receive, send)
        try:
            async with asyncio.timeout(wait):
                await turns.acquire()
        except TimeoutError:
            return await busy(send)
        held = True

        def give_back():
            nonlocal held
            if held:
                held = False
                turns.release()

        async def send_then_give_back(message):
            if message['type'] == 'http.response.start':
                give_back()
            await send(message)

        streaming = uncapped.match(scope.get('path', ''))
        try:
            return await app(scope, receive, send_then_give_back if streaming else send)
        finally:
            give_back()

    return limited


def _application():
    django_app = get_asgi_application()
    return limit_concurrency(django_app, settings.CAMPHORIC_WORKER_CONCURRENCY,
                             settings.CAMPHORIC_WORKER_QUEUE_WAIT)


application = _application()

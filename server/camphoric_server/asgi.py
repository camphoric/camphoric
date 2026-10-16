"""
ASGI config for camphoric_server: what gunicorn's uvicorn workers serve
(SPEC DR-111).

Views stay synchronous: Django runs each request's view in a thread of its
own, each with its own database connection. So each worker serves at most
CAMPHORIC_WORKER_CONCURRENCY requests at once (default 4) and queues the rest,
which keeps the database's connections bounded — workers × that — however
many people press Register at the same moment.

It exposes the ASGI callable as a module-level variable named ``application``.
"""

import asyncio
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'camphoric_server.settings')


def limit_concurrency(app, limit):
    '''Let at most `limit` HTTP requests into `app` at once; the rest wait their turn.'''
    turns = asyncio.Semaphore(limit)

    async def limited(scope, receive, send):
        if scope['type'] != 'http':
            return await app(scope, receive, send)
        async with turns:
            return await app(scope, receive, send)

    return limited


application = limit_concurrency(
    get_asgi_application(), int(os.environ.get('CAMPHORIC_WORKER_CONCURRENCY', '4')))

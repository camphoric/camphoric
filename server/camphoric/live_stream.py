'''
The live change feed's stream (SPEC §5, §9.8, DR-112).

Each worker process has one Broadcaster: a single Postgres connection that
LISTENs on camphoric.live's channel, started when the first admin opens an
event's stream, and fanning each notice out to the streams open on that event.
It checks the connection every CHECK_SECONDS, so one that died silently (a
dropped NAT or firewall path) is noticed; when it drops it reconnects, with
backoff, and tells every stream to `resync` (refetch everything), since notices
may have been missed meanwhile.

`GET /api/events/{id}/stream/` is a Server-Sent Events response: `retry`, a
`hello` once the worker is listening (so what the browser refetches on hello
can't miss a notice), then each notice as `event: change` or `event: lease`,
and a `ping` every PING_SECONDS, so proxies keep it open and the browser can
tell a stream that has silently died from a quiet one. It checks every
RECHECK_SECONDS that the session is still signed in with a role, and closes
after MAX_SECONDS, so the browser reconnects. While it streams it holds no
database connection. It needs the ASGI server (DR-111); under a WSGI dev server
it answers 503 and admins fall back to refetching as before.
'''

import asyncio
from importlib import import_module
import json
import logging
from types import SimpleNamespace

from asgiref.sync import sync_to_async
from django.conf import settings
from django.contrib.auth import get_user
from django.core.handlers.asgi import ASGIRequest
from django.db import connection
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.http import require_GET
import psycopg
from psycopg.conninfo import make_conninfo

from camphoric import accounts, live, models, roles
from camphoric.permissions import PASSWORD_CHANGE_REQUIRED

logger = logging.getLogger(__name__)

PING_SECONDS = 20
MAX_SECONDS = 30 * 60
RECHECK_SECONDS = 5 * 60
CHECK_SECONDS = 60
# How long a new stream waits for its worker to be listening before giving up
# (the browser then tries again).
READY_SECONDS = 10
# Notices a slow stream may fall behind by before it's told to resync instead.
BACKLOG = 200

# libpq's own connection options; Django's (pool, isolation_level, …) aren't.
LIBPQ_OPTIONS = {
    'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'sslpassword', 'sslcrl', 'sslcompression',
    'connect_timeout', 'options', 'application_name', 'target_session_attrs', 'service',
    'passfile', 'channel_binding', 'gssencmode', 'keepalives', 'keepalives_idle',
    'keepalives_interval', 'keepalives_count', 'tcp_user_timeout',
}


def _conninfo():
    db = settings.DATABASES['default']
    params = {'dbname': db.get('NAME'), 'user': db.get('USER'), 'password': db.get('PASSWORD'),
              'host': db.get('HOST'), 'port': db.get('PORT')}
    options = {key: value for key, value in db.get('OPTIONS', {}).items()
               if key in LIBPQ_OPTIONS}
    # So a connection whose path was silently dropped fails rather than waiting
    # forever (unless the settings say otherwise): TCP keepalives while it's
    # idle, and a user timeout once the listener's "still there?" query waits
    # for an answer — keepalives stop then, and TCP would retry for minutes.
    # (psycopg goes on waiting for a query that's cancelled, so the check's own
    # time limit can't end it.)
    keepalives = {'keepalives': 1, 'keepalives_idle': 30, 'keepalives_interval': 10,
                  'keepalives_count': 3, 'tcp_user_timeout': 30_000}
    return make_conninfo('', **{k: v for k, v in params.items() if v},
                         **{**keepalives, **options})


class Broadcaster:
    '''Listens once per process; hands each notice to the streams on its event.'''

    def __init__(self):
        self.streams = {}  # event id -> set of queues
        self.task = None
        self.listening = asyncio.Event()

    def subscribe(self, event_id):
        queue = asyncio.Queue(BACKLOG)
        self.streams.setdefault(event_id, set()).add(queue)
        if self.task is None or self.task.done():
            self.task = asyncio.get_running_loop().create_task(self.listen())
        return queue

    def unsubscribe(self, event_id, queue):
        queues = self.streams.get(event_id, set())
        queues.discard(queue)
        if not queues:
            self.streams.pop(event_id, None)

    def deliver(self, message, queues):
        for queue in list(queues):
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                # It fell too far behind: drop what's waiting and have it refetch.
                while not queue.empty():
                    queue.get_nowait()
                queue.put_nowait({'type': 'resync'})

    def dispatch(self, payload):
        try:
            message = json.loads(payload)
        except ValueError:
            logger.warning(f'live: unreadable notice {payload!r}')
            return
        self.deliver(message, self.streams.get(message.get('event'), ()))

    def everyone(self):
        return [queue for queues in self.streams.values() for queue in queues]

    async def listen(self):
        delay, missed = 1, False
        while True:
            try:
                async with await psycopg.AsyncConnection.connect(
                        _conninfo(), autocommit=True) as conn:
                    await conn.execute(f'LISTEN {live.CHANNEL}')
                    self.listening.set()
                    if missed:
                        self.deliver({'type': 'resync'}, self.everyone())
                    delay, missed = 1, False
                    while True:
                        async for notice in conn.notifies(timeout=CHECK_SECONDS):
                            self.dispatch(notice.payload)
                        # Still there? Ask, and don't wait long for the answer.
                        await asyncio.wait_for(conn.execute('SELECT 1'), CHECK_SECONDS)
            except asyncio.CancelledError:
                self.listening.clear()
                raise
            except Exception:
                self.listening.clear()
                # Without notices the open streams would only seem live: end
                # them, so browsers say they're reconnecting until it's back.
                self.deliver({'type': 'lost'}, self.everyone())
                logger.exception('live: lost the notice connection; reconnecting')
                missed = True
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30)


broadcaster = Broadcaster()


def sse(event, data):
    return f'event: {event}\ndata: {json.dumps(data)}\n\n'


def still_allowed(session_key, user_id):
    '''
    Whether the session still signs the user in — as Django checks each request:
    not signed out, the user active, the password not changed since — and the
    user still has a role and isn't due to change their password.
    '''
    try:
        session = import_module(settings.SESSION_ENGINE).SessionStore(session_key)
        user = get_user(SimpleNamespace(session=session))
        return (user.is_authenticated and user.pk == user_id
                and roles.role_of(user) is not None
                and not accounts.must_change_password(user))
    finally:
        connection.close()


def close_unless_in_transaction():
    if not connection.in_atomic_block:
        connection.close()


async def events(event_id, session_key, user_id):
    '''The stream's text: hello, then notices and pings, until MAX_SECONDS.'''
    queue = broadcaster.subscribe(event_id)
    try:
        try:
            await asyncio.wait_for(broadcaster.listening.wait(), READY_SECONDS)
        except TimeoutError:
            return  # the browser tries again
        yield 'retry: 5000\n' + sse('hello', {'event': event_id})
        loop = asyncio.get_running_loop()
        ends = loop.time() + MAX_SECONDS
        recheck = loop.time() + RECHECK_SECONDS
        while True:
            if loop.time() >= ends:
                # Tell the browser this close is routine; it reconnects at once.
                yield sse('bye', {})
                return
            if loop.time() >= recheck:
                if not await sync_to_async(still_allowed)(session_key, user_id):
                    return
                recheck = loop.time() + RECHECK_SECONDS
            try:
                message = await asyncio.wait_for(
                    queue.get(), min(PING_SECONDS, ends - loop.time()))
            except TimeoutError:
                yield sse('ping', {})
                continue
            if message.get('type') == 'lost':
                return
            if message.get('type') == 'resync':
                yield sse('resync', {})
            else:
                yield sse('lease' if message.get('type') == 'lease' else 'change', message)
    finally:
        broadcaster.unsubscribe(event_id, queue)


@require_GET
async def event_stream(request, event_id):
    user = await request.auser()
    if not user.is_authenticated:
        return JsonResponse({'detail': 'Authentication credentials were not provided.'},
                            status=401)
    if await sync_to_async(roles.role_of)(user) is None:
        return JsonResponse({'detail': 'You do not have permission to perform this action.'},
                            status=403)
    # As the API refuses them (camphoric.permissions), until they choose a new one.
    if await sync_to_async(accounts.must_change_password)(user):
        return JsonResponse({'detail': 'Choose a new password before continuing.',
                             'code': PASSWORD_CHANGE_REQUIRED}, status=403)
    if not await models.Event.objects.filter(pk=event_id).aexists():
        return JsonResponse({'detail': 'No such event.'}, status=404)
    if not isinstance(request, ASGIRequest):
        return JsonResponse({'detail': 'Live updates need the ASGI server.'}, status=503)
    # Streaming holds no database connection; rechecks open their own briefly.
    # (Never mid-transaction, as in a test.)
    await sync_to_async(close_unless_in_transaction)()
    response = StreamingHttpResponse(
        events(event_id, request.session.session_key, user.pk),
        content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'  # nginx: pass each notice on at once
    return response

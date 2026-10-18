'''
The live change feed (SPEC §9.8, DR-112): saves send notices of what changed —
never the record — on Postgres's channel, delivered once per record when the
transaction commits; each event's stream hands them to the admins watching it.
'''

import asyncio
import json
from unittest import mock

from asgiref.sync import sync_to_async
from django.db import transaction
from django.test import SimpleTestCase, TestCase, TransactionTestCase
import psycopg
from rest_framework.test import APITestCase

from camphoric import accounts, leases, live, live_stream, models, roles
from tests.factories import create_template_event, make_user

KEYS = {'type', 'model', 'id', 'event', 'action', 'actor'}


class NoticeTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()

    def setUp(self):
        self.sent = []
        patcher = mock.patch.object(live, 'notify', side_effect=self.sent.append)
        patcher.start()
        self.addCleanup(patcher.stop)

    def notices(self):
        return {(n['model'], n['id'], n['action']) for n in self.sent if n['type'] == 'changed'}

    def test_a_save_says_what_changed_and_nothing_of_it(self):
        made = self.made
        made.cabin_a.name = 'Cabin Alpha'
        made.cabin_a.save()
        [notice] = self.sent
        self.assertEqual(set(notice), KEYS)
        self.assertEqual(notice, {'type': 'changed', 'model': 'lodging', 'id': made.cabin_a.id,
                                  'event': made.event.id, 'action': 'updated', 'actor': None})

    def test_a_camper_and_the_registration_it_reprices(self):
        made = self.made
        made.c1.admin_attributes = {'note': 'x'}
        made.c1.save()
        self.assertIn(('camper', made.c1.id, 'updated'), self.notices())
        self.assertIn(('registration', made.r1.id, 'updated'), self.notices())

    def test_creating_deleting_and_soft_deleting(self):
        made = self.made
        lodging = models.Lodging.objects.create(event=made.event, name='Tents')
        pk = lodging.pk
        lodging.delete()
        made.r3.soft_delete()
        self.assertTrue({('lodging', pk, 'created'), ('lodging', pk, 'deleted'),
                         ('registration', made.r3.id, 'deleted')} <= self.notices())

    def test_each_kind_names_its_event(self):
        made = self.made
        charge = models.CustomCharge.objects.create(
            camper=made.c1, custom_charge_type=made.linens, amount=5)
        self.sent.clear()
        charge.save()
        self.assertIn({'type': 'changed', 'model': 'customcharge', 'id': charge.id,
                       'event': made.event.id, 'action': 'updated', 'actor': None}, self.sent)

    def test_a_promo_codes_excluded_types(self):
        code = models.PromoCode.objects.create(
            event=self.made.event, label='Staff', code='STAFF', pricing_logic={})
        self.sent.clear()
        code.excluded_registration_types.add(self.made.staff)
        self.assertIn(('promocode', code.id, 'updated'), self.notices())

    def test_a_lease(self):
        user = make_user(roles.REGISTRAR, 'reggie')
        leases.acquire(self.made.c1, user, 'tab-1')
        self.assertIn({'type': 'lease', 'model': 'camper', 'id': self.made.c1.id,
                       'event': self.made.event.id}, self.sent)

    def test_an_invitation(self):
        made = self.made
        made.pending.recipient_name = 'Kimberly'
        made.pending.save()
        self.assertIn(('invitation', made.pending.id, 'updated'), self.notices())

    def test_a_sent_invitation(self):
        from camphoric.mail import outbox
        message = outbox.enqueue(
            event=self.made.event, kind=models.EmailMessageKind.INVITATION,
            invitation=self.made.pending, from_email='camp@example.com',
            to='kim@example.com', subject='Join us', text='Hi')
        outbox.deliver(message.id)  # tests run tasks at once; a second go changes nothing
        self.made.pending.refresh_from_db()
        self.assertIsNotNone(self.made.pending.sent_time)
        self.assertIn(('invitation', self.made.pending.id, 'updated'), self.notices())

    def test_a_sent_confirmation(self):
        from camphoric import confirmations
        with mock.patch.object(confirmations, 'queue_confirmation_email', return_value=None):
            confirmations.send_confirmation(self.made.r1, request=None)
        self.assertIn(('registration', self.made.r1.id, 'updated'), self.notices())


class ActorTests(APITestCase):
    def test_a_notice_names_who_made_the_change(self):
        made = create_template_event()
        reggie = make_user(roles.REGISTRAR, 'reggie', first_name='Reggie')
        self.client.force_authenticate(reggie)
        sent = []
        with mock.patch.object(live, 'notify', side_effect=sent.append):
            self.client.patch(f'/api/lodgings/{made.cabin_a.id}/', {'name': 'A'}, format='json')
        self.assertEqual(sent[0]['actor'], {'id': reggie.id, 'name': 'Reggie'})


def listener():
    '''A Postgres connection listening on the channel, as the broadcaster does.'''
    conn = psycopg.connect(live_stream._conninfo(), autocommit=True)
    conn.execute(f'LISTEN {live.CHANNEL}')
    return conn


def heard(conn):
    return [json.loads(n.payload) for n in conn.notifies(timeout=0.5, stop_after=50)]


class DeliveryTests(TransactionTestCase):
    def test_once_per_record_on_commit_and_never_on_rollback(self):
        made = create_template_event()
        conn = listener()
        self.addCleanup(conn.close)
        heard(conn)  # what setting up the event sent

        with transaction.atomic():
            for note in ('a', 'b', 'c'):
                made.cabin_a.notes = note
                made.cabin_a.save()
        lodging = [n for n in heard(conn) if n['model'] == 'lodging']
        self.assertEqual(len(lodging), 1)

        with transaction.atomic():
            made.cabin_a.notes = 'never'
            made.cabin_a.save()
            transaction.set_rollback(True)
        self.assertEqual(heard(conn), [])


class StreamAccessTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()
        cls.path = f'/api/events/{cls.made.event.id}/stream/'

    def test_who_may_watch(self):
        self.assertEqual(self.client.get(self.path).status_code, 401)
        self.client.force_login(make_user(None, 'nobody'))
        self.assertEqual(self.client.get(self.path).status_code, 403)
        self.client.force_login(make_user(roles.REPORTER, 'rita'))
        self.assertEqual(self.client.get('/api/events/999999/stream/').status_code, 404)

    def test_not_while_the_password_must_be_changed(self):
        rita = make_user(roles.REPORTER, 'rita')
        accounts.set_must_change_password(rita, True)
        self.client.force_login(rita)
        response = self.client.get(self.path)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['code'], 'password_change_required')

    def test_a_wsgi_server_says_it_cant(self):
        self.client.force_login(make_user(roles.REPORTER, 'rita'))
        self.assertEqual(self.client.get(self.path).status_code, 503)


class StreamTests(TestCase):
    async def test_streams_hello_then_its_events_notices(self):
        made = await sync_to_async(create_template_event)()
        user = await sync_to_async(make_user)(roles.REPORTER, 'rita')
        await self.async_client.aforce_login(user)
        with mock.patch.object(live_stream.broadcaster, 'listen', new=mock.AsyncMock()), \
                mock.patch.object(live_stream.broadcaster, 'listening', asyncio.Event()):
            live_stream.broadcaster.listening.set()
            response = await self.async_client.get(f'/api/events/{made.event.id}/stream/')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response['Content-Type'], 'text/event-stream')
            self.assertEqual(response['X-Accel-Buffering'], 'no')
            chunks = aiter(response.streaming_content)
            first = (await anext(chunks)).decode()
            self.assertTrue(first.startswith('retry: 5000\nevent: hello\n'))

            next_chunk = asyncio.ensure_future(anext(chunks))
            await asyncio.sleep(0)
            live_stream.broadcaster.dispatch(json.dumps(
                {'type': 'changed', 'model': 'camper', 'id': 1, 'event': made.event.id}))
            live_stream.broadcaster.dispatch(json.dumps(
                {'type': 'changed', 'model': 'camper', 'id': 2, 'event': made.event.id + 1}))
            text = (await asyncio.wait_for(next_chunk, 2)).decode()
            self.assertTrue(text.startswith('event: change\ndata: '))
            self.assertEqual(json.loads(text.split('data: ')[1])['id'], 1)

            # The admin leaves: the server cancels the wait for the next notice.
            waiting = asyncio.ensure_future(anext(chunks))
            await asyncio.sleep(0)
            waiting.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await waiting
        self.assertEqual(live_stream.broadcaster.streams, {})


class StreamLifeTests(SimpleTestCase):
    async def test_no_hello_until_the_worker_is_listening(self):
        broadcaster = live_stream.Broadcaster()
        broadcaster.task = asyncio.get_running_loop().create_future()
        with mock.patch.object(live_stream, 'broadcaster', broadcaster), \
                mock.patch.object(live_stream, 'READY_SECONDS', 0.05):
            chunks = [chunk async for chunk in live_stream.events(4, 'key', 1)]
        self.assertEqual(chunks, [])  # it ends, and the browser tries again
        self.assertEqual(broadcaster.streams, {})

    async def test_it_ends_once_the_session_is_no_longer_allowed(self):
        broadcaster = live_stream.Broadcaster()
        broadcaster.task = asyncio.get_running_loop().create_future()
        broadcaster.listening.set()
        with mock.patch.object(live_stream, 'broadcaster', broadcaster), \
                mock.patch.object(live_stream, 'RECHECK_SECONDS', 0), \
                mock.patch.object(live_stream, 'still_allowed', return_value=False):
            chunks = [chunk async for chunk in live_stream.events(4, 'key', 1)]
        self.assertEqual(len(chunks), 1)  # hello, then nothing more
        self.assertEqual(broadcaster.streams, {})

    async def test_it_says_goodbye_at_its_routine_close(self):
        broadcaster = live_stream.Broadcaster()
        broadcaster.task = asyncio.get_running_loop().create_future()
        broadcaster.listening.set()
        with mock.patch.object(live_stream, 'broadcaster', broadcaster), \
                mock.patch.object(live_stream, 'MAX_SECONDS', 0):
            chunks = [chunk async for chunk in live_stream.events(4, 'key', 1)]
        self.assertTrue(chunks[-1].startswith('event: bye\n'))

    async def test_it_ends_when_its_worker_stops_hearing_notices(self):
        broadcaster = live_stream.Broadcaster()
        broadcaster.task = asyncio.get_running_loop().create_future()
        broadcaster.listening.set()
        with mock.patch.object(live_stream, 'broadcaster', broadcaster):
            stream = live_stream.events(4, 'key', 1)
            await anext(stream)  # hello
            broadcaster.deliver({'type': 'lost'}, broadcaster.everyone())
            self.assertEqual([chunk async for chunk in stream], [])

    def test_the_listener_takes_only_libpq_options(self):
        options = {'sslmode': 'require', 'pool': True, 'isolation_level': 1,
                   'server_side_binding': True}
        with mock.patch.dict(live_stream.settings.DATABASES['default'], {'OPTIONS': options}):
            conninfo = live_stream._conninfo()
        self.assertIn('sslmode=require', conninfo)
        self.assertNotIn('pool', conninfo)

    def test_the_listener_gives_up_on_a_dropped_connection(self):
        conninfo = live_stream._conninfo()
        self.assertIn('keepalives=1', conninfo)
        # Once its check waits for an answer, keepalives no longer apply.
        self.assertIn('tcp_user_timeout=30000', conninfo)
        options = {'tcp_user_timeout': 5000}
        with mock.patch.dict(live_stream.settings.DATABASES['default'], {'OPTIONS': options}):
            self.assertIn('tcp_user_timeout=5000', live_stream._conninfo())


class SessionCheckTests(TestCase):
    def test_a_session_still_signed_in_with_a_role_is_allowed(self):
        from django.test import Client
        user = make_user(roles.REGISTRAR, 'reggie')
        client = Client()
        client.force_login(user)
        key = client.session.session_key
        with mock.patch.object(live_stream, 'close_unless_in_transaction'), \
                mock.patch.object(live_stream.connection, 'close'):
            self.assertTrue(live_stream.still_allowed(key, user.id))
            client.logout()
            self.assertFalse(live_stream.still_allowed(key, user.id))

    def test_a_password_to_be_changed_ends_its_streams(self):
        from django.test import Client
        user = make_user(roles.REGISTRAR, 'reggie')
        client = Client()
        client.force_login(user)
        key = client.session.session_key
        accounts.set_must_change_password(user, True)
        with mock.patch.object(live_stream.connection, 'close'):
            self.assertFalse(live_stream.still_allowed(key, user.id))

    def test_changing_the_password_signs_its_streams_out(self):
        from django.test import Client
        user = make_user(roles.REGISTRAR, 'reggie')
        client = Client()
        client.force_login(user)
        key = client.session.session_key
        user.set_password('a-new-one')
        user.save()
        with mock.patch.object(live_stream.connection, 'close'):
            self.assertFalse(live_stream.still_allowed(key, user.id))


class BroadcasterTests(SimpleTestCase):
    async def asyncSetUp(self):
        self.broadcaster = live_stream.Broadcaster()
        # Not listening: these tests hand it notices themselves.
        self.broadcaster.task = asyncio.get_running_loop().create_future()

    async def test_each_stream_gets_only_its_events_notices(self):
        await self.asyncSetUp()
        four, five = self.broadcaster.subscribe(4), self.broadcaster.subscribe(5)
        self.broadcaster.dispatch(json.dumps({'type': 'changed', 'event': 4, 'id': 1}))
        self.assertEqual(four.get_nowait()['id'], 1)
        self.assertTrue(five.empty())

    async def test_a_stream_too_far_behind_is_told_to_resync(self):
        await self.asyncSetUp()
        queue = self.broadcaster.subscribe(4)
        for i in range(live_stream.BACKLOG + 1):
            self.broadcaster.dispatch(json.dumps({'type': 'changed', 'event': 4, 'id': i}))
        self.assertEqual(queue.get_nowait(), {'type': 'resync'})

    async def test_leaving_takes_the_stream_away(self):
        await self.asyncSetUp()
        queue = self.broadcaster.subscribe(4)
        self.broadcaster.unsubscribe(4, queue)
        self.assertEqual(self.broadcaster.streams, {})


class ListenTests(TransactionTestCase):
    async def test_hears_a_real_notice(self):
        broadcaster = live_stream.Broadcaster()
        queue = broadcaster.subscribe(4)
        try:
            for _ in range(50):  # until its LISTEN is in place
                await sync_to_async(live.notify)({'type': 'changed', 'event': 4, 'id': 0})
                try:
                    message = await asyncio.wait_for(queue.get(), 0.1)
                    break
                except TimeoutError:
                    continue
            self.assertEqual(message['event'], 4)
        finally:
            broadcaster.task.cancel()

import datetime
import signal
from unittest import mock

from django.core import mail
from django.core.management import call_command
from django.core.management.base import CommandError
from django.tasks.signals import task_finished
from django.test import TestCase, override_settings
from django.utils import timezone
from django_tasks_db.models import DBTaskResult
from freezegun import freeze_time

from camphoric import models, worker
from camphoric.mail import outbox
from camphoric.mail.tasks import deliver_message
from camphoric.test.tasks import clear_deferred_tasks

Status = models.EmailMessageStatus

# The real queue: tasks are rows that a worker runs.
DATABASE_QUEUE = override_settings(TASKS={'default': {
    'BACKEND': 'django_tasks_db.DatabaseBackend', 'QUEUES': ['email', 'default']}})


class WorkerTestCase(TestCase):
    def setUp(self):
        clear_deferred_tasks()
        organization = models.Organization.objects.create(name='Org')
        self.event = models.Event.objects.create(organization=organization, name='Camp')

    def message(self, **fields):
        return models.EmailMessage.objects.create(**{
            'event': self.event, 'kind': models.EmailMessageKind.CONFIRMATION,
            'to': 'pat@example.com', 'from_email': 'camp@example.com',
            'subject': 'Hi', 'text': 'Hi', **fields})


class RecoverTests(WorkerTestCase):
    def test_an_expired_lease_is_tried_again(self):
        stuck = self.message(status=Status.SENDING,
                             lease_until=timezone.now() - datetime.timedelta(seconds=1))
        self.assertEqual(outbox.recover(), (1, 0))
        stuck.refresh_from_db()
        self.assertEqual(stuck.status, Status.SENT)
        self.assertEqual(stuck.attempts, 2)  # the stopped attempt counts
        self.assertEqual(len(mail.outbox), 1)

    def test_a_current_lease_is_left_alone(self):
        sending = self.message(status=Status.SENDING,
                               lease_until=timezone.now() + datetime.timedelta(minutes=1))
        self.assertEqual(outbox.recover(), (0, 0))
        sending.refresh_from_db()
        self.assertEqual(sending.status, Status.SENDING)

    def test_a_message_that_keeps_stopping_its_worker_fails(self):
        stuck = self.message(status=Status.SENDING, attempts=outbox.MAX_ATTEMPTS - 1,
                             lease_until=timezone.now() - datetime.timedelta(seconds=1))
        outbox.recover()
        stuck.refresh_from_db()
        self.assertEqual(stuck.status, Status.FAILED)
        self.assertEqual(mail.outbox, [])

    def test_an_overdue_message_is_woken_unless_a_task_waits(self):
        long_ago = timezone.now() - datetime.timedelta(minutes=10)
        lost = self.message(next_attempt_at=long_ago)
        waiting = self.message(next_attempt_at=long_ago)
        recent = self.message(next_attempt_at=timezone.now())
        self.assertEqual(outbox.recover(pending_ids={waiting.id}), (0, 1))
        for message, status in [(lost, Status.SENT), (waiting, Status.QUEUED),
                                (recent, Status.QUEUED)]:
            message.refresh_from_db()
            self.assertEqual(message.status, status)


class ReconcileTests(WorkerTestCase):
    def test_reconcile_recovers_and_prunes(self):
        self.message(status=Status.SENDING,
                     lease_until=timezone.now() - datetime.timedelta(seconds=1))
        old = timezone.now() - datetime.timedelta(days=8)
        models.WorkerHeartbeat.objects.create(worker_id='old', hostname='h', pid=1,
                                              started_at=old, seen_at=old)
        self.assertEqual(worker.reconcile.call(),
                         {'requeued': 1, 'rewoken': 0, 'abandoned': 0})
        self.assertFalse(models.WorkerHeartbeat.objects.exists())

    def test_without_the_database_queue_nothing_is_scheduled(self):
        self.assertFalse(worker.schedule_reconcile())

    @DATABASE_QUEUE
    def test_there_is_only_one_reconcile_chain(self):
        self.assertTrue(worker.schedule_reconcile())
        self.assertFalse(worker.schedule_reconcile())
        waiting = DBTaskResult.objects.get(task_path=worker.reconcile.module_path)
        self.assertEqual(waiting.status, 'READY')
        self.assertGreater(waiting.run_after, timezone.now())

    @DATABASE_QUEUE
    def test_pending_deliveries_are_not_woken_again(self):
        message = self.message()
        outbox.wake(message)
        self.assertEqual(worker._pending_message_ids(), {message.id})

    @DATABASE_QUEUE
    def test_tasks_of_a_dead_worker_are_failed(self):
        dead = deliver_message.enqueue(1)
        live = deliver_message.enqueue(2)
        recent = deliver_message.enqueue(3)
        long_ago = timezone.now() - datetime.timedelta(hours=2)
        for result, worker_id, started in [(dead, 'dead', long_ago), (live, 'live', long_ago),
                                           (recent, 'dead', timezone.now())]:
            DBTaskResult.objects.filter(id=result.id).update(
                status='RUNNING', started_at=started, worker_ids=[worker_id])
        models.WorkerHeartbeat.objects.create(worker_id='live', hostname='h', pid=1,
                                              started_at=long_ago, seen_at=timezone.now())

        self.assertEqual(worker._fail_abandoned_tasks(), 1)
        statuses = {str(id): status for id, status in
                    DBTaskResult.objects.values_list('id', 'status')}
        self.assertEqual(statuses[dead.id], 'FAILED')
        self.assertEqual(statuses[live.id], 'RUNNING')
        self.assertEqual(statuses[recent.id], 'RUNNING')


class HeartbeatTests(WorkerTestCase):
    def test_beats_are_recorded_and_throttled(self):
        heartbeat = worker.Heartbeat('w1')
        with freeze_time('2026-09-01 12:00:00') as clock:
            heartbeat.beat()
            clock.tick(datetime.timedelta(seconds=5))
            heartbeat.beat()  # too soon to write again
            row = models.WorkerHeartbeat.objects.get(worker_id='w1')
            self.assertEqual(row.seen_at, datetime.datetime(2026, 9, 1, 12, 0,
                                                            tzinfo=datetime.timezone.utc))
        self.assertFalse(heartbeat.stale(60))

    @DATABASE_QUEUE  # the worker's options require the database queue
    def test_health_check(self):
        with self.assertRaises(CommandError):
            call_command('camphoric_worker', check=True)
        worker.Heartbeat('w1').beat()
        call_command('camphoric_worker', check=True)
        models.WorkerHeartbeat.objects.update(
            seen_at=timezone.now() - worker.STALE - datetime.timedelta(seconds=1))
        with self.assertRaises(CommandError):
            call_command('camphoric_worker', check=True)


@DATABASE_QUEUE
class WorkerCommandTests(WorkerTestCase):
    def setUp(self):
        super().setUp()
        self.signals = {s: signal.getsignal(s) for s in (signal.SIGINT, signal.SIGTERM)}

    def tearDown(self):
        for number, handler in self.signals.items():
            signal.signal(number, handler)
        task_finished.disconnect(dispatch_uid='heartbeat-test-worker')

    def test_a_batch_run_delivers_the_queue(self):
        message = outbox.enqueue(event=self.event, kind=models.EmailMessageKind.CONFIRMATION,
                                 to='pat@example.com', from_email='camp@example.com',
                                 subject='Hi', text='Hi')
        self.assertEqual(mail.outbox, [])  # queued: nothing runs until a worker does

        # The worker closes idle database connections between tasks, which would
        # close the test's transaction.
        with mock.patch('django_tasks_db.management.commands.db_worker.close_old_connections'):
            call_command('camphoric_worker', batch=True, reload=False, queue_name='*',
                         worker_id='test-worker', startup_delay=False, verbosity=0)

        message.refresh_from_db()
        self.assertEqual(message.status, Status.SENT)
        self.assertEqual(len(mail.outbox), 1)
        self.assertTrue(models.WorkerHeartbeat.objects.filter(worker_id='test-worker').exists())
        # The worker seeded the reconciler, which ran and scheduled its next run.
        reconciles = DBTaskResult.objects.filter(task_path=worker.reconcile.module_path)
        self.assertEqual(sorted(reconciles.values_list('status', flat=True)),
                         ['READY', 'SUCCESSFUL'])

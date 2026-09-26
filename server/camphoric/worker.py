'''
What keeps the background task worker healthy (SPEC DR-44). `manage.py
camphoric_worker` wires these into django-tasks-db's worker.

- The reconciler, a task that runs every minute by re-enqueueing itself. It
  recovers the email outbox (camphoric.mail.outbox.recover), marks tasks whose
  worker died as failed, and prunes old task results and heartbeats.
- The heartbeat a worker writes as it finishes tasks (the reconciler's run
  makes one at least every minute). The admin warns when no worker has
  reported in; `camphoric_worker --check` is the container health check.
- The watchdog, a thread that exits a worker whose heartbeat goes stale (a task
  that never returns), so its supervisor starts a fresh one. Under systemd it
  also pets the unit's watchdog while the heartbeat is fresh, which catches a
  process too frozen for the thread to notice.
'''

from datetime import timedelta
import logging
import os
import socket
import threading
import time

from django.core.management import call_command
from django.db import connection, transaction
from django.tasks import task
from django.tasks.signals import task_finished
from django.utils import timezone

from camphoric import models

logger = logging.getLogger(__name__)

RECONCILE_EVERY = timedelta(minutes=1)
# The admin warns, and the health check fails, after this long without a heartbeat.
STALE = timedelta(minutes=2)
# A task still "running" this long, on a worker that's no longer reporting in, is abandoned.
ABANDONED = timedelta(hours=1)
KEEP_TASK_RESULTS_DAYS = 14
KEEP_HEARTBEATS = timedelta(days=7)
# At most one heartbeat write per this many seconds.
HEARTBEAT_WRITE_EVERY = 15

_RECONCILE_LOCK = 0x43616D70  # a Postgres advisory lock key


def _database_backend(task_obj):
    '''django-tasks-db's backend for this task, or None (immediate mode, tests).'''
    from django_tasks_db.backend import DatabaseBackend

    backend = task_obj.get_backend()
    return backend if isinstance(backend, DatabaseBackend) else None


def _task_results():
    from django_tasks_db.models import DBTaskResult

    return DBTaskResult.objects


@task(priority=90)
def reconcile():
    from camphoric.mail import outbox

    try:
        requeued, rewoken = outbox.recover(pending_ids=_pending_message_ids())
        abandoned = _fail_abandoned_tasks()
        _prune()
        return {'requeued': requeued, 'rewoken': rewoken, 'abandoned': abandoned}
    finally:
        schedule_reconcile(delay=RECONCILE_EVERY)


def schedule_reconcile(delay=RECONCILE_EVERY):
    '''
    Enqueue the next reconcile run unless one is already waiting (so there's
    only ever one chain). Returns whether it enqueued one. Only the database
    backend runs a reconciler.
    '''
    if _database_backend(reconcile) is None:
        return False
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_advisory_xact_lock(%s)', [_RECONCILE_LOCK])
        if _task_results().filter(task_path=reconcile.module_path, status='READY').exists():
            return False
        reconcile.using(run_after=timezone.now() + delay).enqueue()
    return True


def _pending_message_ids():
    '''Ids of the messages with a delivery task still waiting or running.'''
    from camphoric.mail.tasks import deliver_message

    if _database_backend(deliver_message) is None:
        return set()
    rows = (_task_results()
            .filter(task_path=deliver_message.module_path, status__in=['READY', 'RUNNING'])
            .values_list('args_kwargs', flat=True))
    return {row['args'][0] for row in rows if row.get('args')}


def _fail_abandoned_tasks():
    '''Mark as failed the tasks left "running" by a worker that died.'''
    if _database_backend(reconcile) is None:
        return 0
    now = timezone.now()
    live = set(models.WorkerHeartbeat.objects.filter(seen_at__gt=now - STALE)
               .values_list('worker_id', flat=True))
    abandoned = 0
    for result in _task_results().filter(status='RUNNING', started_at__lt=now - ABANDONED):
        if live.intersection(result.worker_ids):
            continue
        abandoned += _task_results().filter(id=result.id, status='RUNNING').update(
            status='FAILED', finished_at=now,
            exception_class_path='camphoric.worker.WorkerStopped',
            traceback='The worker running this task stopped before it finished.')
    return abandoned


def _prune():
    models.WorkerHeartbeat.objects.filter(seen_at__lt=timezone.now() - KEEP_HEARTBEATS).delete()
    if _database_backend(reconcile) is not None:
        call_command('prune_db_task_results', queue_name='*',
                     min_age_days=KEEP_TASK_RESULTS_DAYS, verbosity=0)


def last_seen():
    '''When a worker last reported in, or None.'''
    latest = models.WorkerHeartbeat.objects.order_by('-seen_at').first()
    return latest.seen_at if latest else None


def is_alive():
    seen = last_seen()
    return seen is not None and seen > timezone.now() - STALE


def sd_notify(state):
    '''Tell systemd `state` (READY=1, WATCHDOG=1) when running under a notify unit.'''
    address = os.environ.get('NOTIFY_SOCKET')
    if not address:
        return
    if address.startswith('@'):
        address = '\0' + address[1:]  # an abstract socket
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM) as sock:
            sock.connect(address)
            sock.sendall(state.encode())
    except OSError as error:
        logger.warning(f'systemd notify failed: {error}')


class Heartbeat:
    def __init__(self, worker_id):
        self.worker_id = worker_id
        self.started_at = timezone.now()
        self.last = time.monotonic()
        self._written = None

    def beat(self, **kwargs):
        '''Note that the worker is alive; also a task_finished receiver.'''
        self.last = time.monotonic()
        if self._written is not None and self.last - self._written < HEARTBEAT_WRITE_EVERY:
            return
        self._written = self.last
        try:
            models.WorkerHeartbeat.objects.update_or_create(
                worker_id=self.worker_id,
                defaults={'hostname': socket.gethostname(), 'pid': os.getpid(),
                          'started_at': self.started_at, 'seen_at': timezone.now()})
        except Exception as error:
            logger.warning(f'heartbeat not recorded: {error}')

    def start(self, watchdog_seconds):
        '''Record the first heartbeat, beat after every task, and start the watchdog.'''
        self.beat()
        task_finished.connect(self.beat, weak=False, dispatch_uid=f'heartbeat-{self.worker_id}')
        sd_notify('READY=1')
        if watchdog_seconds:
            threading.Thread(target=self._watch, args=(watchdog_seconds,),
                             name='camphoric-watchdog', daemon=True).start()

    def stale(self, limit_seconds):
        return time.monotonic() - self.last > limit_seconds

    def _watch(self, limit_seconds):
        while True:
            time.sleep(min(15, limit_seconds / 4))
            if self.stale(limit_seconds):
                logger.critical(
                    f'worker {self.worker_id}: no heartbeat for over {limit_seconds}s, so a '
                    'task seems stuck; exiting so the worker is restarted')
                logging.shutdown()
                os._exit(1)
            sd_notify('WATCHDOG=1')

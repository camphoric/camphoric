'''
The background task worker: django-tasks-db's `db_worker` (same options) plus
Camphoric's heartbeat, watchdog and reconciler (camphoric.worker).

    manage.py camphoric_worker --queue-name '*'         # run a worker
    manage.py camphoric_worker --check                  # health check
'''

from datetime import timedelta
import os

from django.core.management.base import CommandError
from django.utils.autoreload import DJANGO_AUTORELOAD_ENV
from django_tasks_db.management.commands.db_worker import Command as DatabaseWorkerCommand

from camphoric import worker


class Command(DatabaseWorkerCommand):
    help = ("Run the background task worker (django-tasks-db's db_worker) with a heartbeat, "
            "a watchdog, and the every-minute reconciler.")

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument(
            '--watchdog', type=int, default=600, metavar='SECONDS',
            help='Exit (for the supervisor to restart the worker) after this many seconds '
                 'without a heartbeat; 0 turns it off (default: %(default)s)')
        parser.add_argument(
            '--check', action='store_true',
            help='Exit successfully if a worker has reported in within the last '
                 f'{int(worker.STALE.total_seconds()) // 60} minutes, and fail otherwise')

    def handle(self, *, check=False, watchdog=600, **options):
        if check:
            if not worker.is_alive():
                seen = worker.last_seen()
                raise CommandError('No worker has reported in recently (last: '
                                   f'{seen.isoformat() if seen else "never"})')
            return

        # With --reload the command runs twice: a parent that only watches for
        # code changes, and the child that works. Only the child reports in.
        reloading_parent = (options['reload'] and not options['batch']
                            and os.environ.get(DJANGO_AUTORELOAD_ENV) != 'true')
        if not reloading_parent:
            worker.schedule_reconcile(delay=timedelta(0))
            heartbeat = worker.Heartbeat(options['worker_id'])
            heartbeat.start(0 if options['batch'] else watchdog)
        super().handle(**options)

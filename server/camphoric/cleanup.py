'''
The nightly clean-up (SPEC §9.3, DR-76). Registration drafts with no activity in
CAMPHORIC_INCOMPLETE_RETENTION_DAYS are deleted, leaving nothing in the audit log
(DR-139, DR-140). Lapsed edit leases (camphoric.leases) are deleted too, and so are
expired OAuth tokens and codes, with the app connections they leave with nothing
that works (camphoric.oauth, DR-148).

`clean_up` runs at CLEAN_UP_AT each night and schedules the next night's run,
a chain like the reconciler's (camphoric.worker); `manage.py camphoric_worker`
starts it.
'''

from datetime import UTC, datetime, time, timedelta
import logging

from django.conf import settings
from django.tasks import task
from django.utils import timezone

from camphoric import leases, models, oauth, worker

logger = logging.getLogger(__name__)

# In UTC: 3 a.m. in California, where the camps are.
CLEAN_UP_AT = time(10, 0)

_CLEAN_UP_LOCK = 0x436C6E55  # a Postgres advisory lock key


def _cutoff(now=None):
    retention = timedelta(days=settings.CAMPHORIC_INCOMPLETE_RETENTION_DAYS)
    return (now or timezone.now()) - retention


def abandoned_drafts(now=None):
    '''The registration drafts with no activity for the retention period.'''
    return models.RegistrationDraft.objects.filter(last_activity_at__lt=_cutoff(now))


def delete_abandoned_drafts(now=None):
    '''Delete the abandoned drafts; returns how many there were.'''
    deleted, _ = abandoned_drafts(now).delete()
    if deleted:
        logger.info(f'Deleted {deleted} abandoned registration draft(s)')
    return deleted


def next_run(now=None):
    '''The first CLEAN_UP_AT after `now`.'''
    now = now or timezone.now()
    run = datetime.combine(now.astimezone(UTC).date(), CLEAN_UP_AT, tzinfo=UTC)
    return run if run > now else run + timedelta(days=1)


@task()
def clean_up():
    try:
        return {
            'deleted_drafts': delete_abandoned_drafts(),
            # Lapsed edit leases are ignored anyway; this only tidies them away.
            'purged_leases': leases.purge_lapsed(),
            'lapsed_app_connections': oauth.clean_up(),
        }
    finally:
        schedule_clean_up()


def schedule_clean_up():
    '''Enqueue the next night's run unless one is already waiting.'''
    return worker.enqueue_once(clean_up, next_run(), _CLEAN_UP_LOCK)

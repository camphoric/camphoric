'''
The nightly clean-up (SPEC §9.3, DR-76). Incomplete registrations, those started but
never finished, that nobody has changed in INCOMPLETE_REGISTRATION_MAX_AGE are
deleted for real, with their campers, charges and pricing overrides; the audit
log keeps their last values. One with a payment, even a deleted payment, is
left alone.

`clean_up` runs at CLEAN_UP_AT each night and schedules the next night's run,
a chain like the reconciler's (camphoric.worker); `manage.py camphoric_worker`
starts it.
'''

from datetime import UTC, datetime, time, timedelta
import logging

from django.db import transaction
from django.tasks import task
from django.utils import timezone

from camphoric import models, worker

logger = logging.getLogger(__name__)

INCOMPLETE_REGISTRATION_MAX_AGE = timedelta(days=30)
# In UTC: 3 a.m. in California, where the camps are.
CLEAN_UP_AT = time(10, 0)

_CLEAN_UP_LOCK = 0x436C6E55  # a Postgres advisory lock key


def abandoned_registrations(now=None):
    '''The incomplete registrations unchanged for the max age, with no payment.'''
    cutoff = (now or timezone.now()) - INCOMPLETE_REGISTRATION_MAX_AGE
    return models.Registration.all_objects.filter(
        completed=False, updated_at__lt=cutoff, payment__isnull=True)


def delete_abandoned_registrations(now=None):
    '''Delete the abandoned registrations; returns how many there were.'''
    with transaction.atomic():
        ids = list(abandoned_registrations(now).values_list('id', flat=True))
        models.Registration.all_objects.filter(id__in=ids).delete()
    if ids:
        logger.info(f'Deleted {len(ids)} abandoned registration(s): {ids}')
    return len(ids)


def next_run(now=None):
    '''The first CLEAN_UP_AT after `now`.'''
    now = now or timezone.now()
    run = datetime.combine(now.astimezone(UTC).date(), CLEAN_UP_AT, tzinfo=UTC)
    return run if run > now else run + timedelta(days=1)


@task()
def clean_up():
    try:
        return {'deleted_registrations': delete_abandoned_registrations()}
    finally:
        schedule_clean_up()


def schedule_clean_up():
    '''Enqueue the next night's run unless one is already waiting.'''
    return worker.enqueue_once(clean_up, next_run(), _CLEAN_UP_LOCK)

'''
The nightly clean-up (SPEC §9.3, DR-76). Incomplete registrations, those started but
never finished, that nobody has changed in CAMPHORIC_INCOMPLETE_RETENTION_DAYS are
deleted for real, with their campers, charges and pricing overrides, and leave
nothing in the audit log (DR-139). One with a payment, even a deleted payment, is
left alone. Lapsed edit leases (camphoric.leases) are deleted too.

`clean_up` runs at CLEAN_UP_AT each night and schedules the next night's run,
a chain like the reconciler's (camphoric.worker); `manage.py camphoric_worker`
starts it.
'''

from datetime import UTC, datetime, time, timedelta
import logging

from django.conf import settings
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.tasks import task
from django.utils import timezone

from camphoric import leases, models, worker

logger = logging.getLogger(__name__)

# In UTC: 3 a.m. in California, where the camps are.
CLEAN_UP_AT = time(10, 0)

_CLEAN_UP_LOCK = 0x436C6E55  # a Postgres advisory lock key


def abandoned_registrations(now=None):
    '''
    The incomplete registrations unchanged for the retention period, with no
    payment, nor a PayPal capture on one of their invoices that may yet be recorded as
    one (#767).
    '''
    retention = timedelta(days=settings.CAMPHORIC_INCOMPLETE_RETENTION_DAYS)
    cutoff = (now or timezone.now()) - retention
    capturing = models.Invoice.all_objects.filter(
        registration=OuterRef('pk'), paypal_capture_order_id__isnull=False)
    return models.Registration.all_objects.filter(
        completed=False, updated_at__lt=cutoff, payment__isnull=True).exclude(
        Exists(capturing))


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
        return {
            'deleted_registrations': delete_abandoned_registrations(),
            # Lapsed edit leases are ignored anyway; this only tidies them away.
            'purged_leases': leases.purge_lapsed(),
        }
    finally:
        schedule_clean_up()


def schedule_clean_up():
    '''Enqueue the next night's run unless one is already waiting.'''
    return worker.enqueue_once(clean_up, next_run(), _CLEAN_UP_LOCK)

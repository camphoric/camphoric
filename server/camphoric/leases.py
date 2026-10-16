'''
Edit leases (SPEC §9.8, DR-110): who is editing which record, as a courtesy so
two people don't set about the same change. A browser tab takes a record's
lease when its user starts changing it, renews it every half minute while the
changes are unsaved, and gives it up on saving or dropping them. A lease not
renewed for LEASE_TTL lapses, so one left by a closed laptop doesn't linger.
Anyone may take over a lease; its holder learns so at their next renewal.
Leases never stop a save: record versions do (DR-109).
'''

from datetime import timedelta

from django.contrib.contenttypes.models import ContentType
from django.db import IntegrityError, transaction
from django.utils import timezone

from camphoric import models, tracked

LEASE_TTL = timedelta(seconds=90)


class LeaseHeld(Exception):
    '''Someone else holds the record's lease.'''

    def __init__(self, lease):
        super().__init__(f'{lease} holds it')
        self.lease = lease


def _of(instance):
    return models.EditLease.objects.filter(
        content_type=ContentType.objects.get_for_model(instance), object_id=instance.pk)


def active(leases, now=None):
    return leases.filter(expires_at__gt=now or timezone.now())


def current(instance, now=None):
    '''The record's lease, if it hasn't lapsed.'''
    return active(_of(instance), now).select_related('user').first()


def acquire(instance, user, client_id, takeover=False, now=None, _retried=False):
    '''
    Take or renew the record's lease for `client_id` (a tab of `user`) for
    LEASE_TTL. Raises LeaseHeld when another tab holds it, unless `takeover`.
    '''
    now = now or timezone.now()
    expires_at = now + LEASE_TTL
    try:
        with transaction.atomic():
            lease = _of(instance).select_for_update().first()
            if lease is None:
                return models.EditLease.objects.create(
                    content_type=ContentType.objects.get_for_model(instance),
                    object_id=instance.pk, event_id=tracked.event_id_of(instance), user=user,
                    client_id=client_id, acquired_at=now, expires_at=expires_at)
            held = lease.expires_at > now
            if held and lease.client_id != client_id and not takeover:
                raise LeaseHeld(lease)
            if not held or lease.client_id != client_id:
                lease.user, lease.client_id, lease.acquired_at = user, client_id, now
            lease.expires_at = expires_at
            lease.save()
            return lease
    except IntegrityError:
        # Another tab took it in the same instant: go by theirs, once.
        if _retried:
            raise
        return acquire(instance, user, client_id, takeover, now, _retried=True)


def release(lease_id, client_id):
    '''Give up a lease, if `client_id` still holds it.'''
    models.EditLease.objects.filter(pk=lease_id, client_id=client_id).delete()


def purge_lapsed(now=None):
    '''Delete the leases that have lapsed; returns how many.'''
    deleted, _ = models.EditLease.objects.filter(
        expires_at__lte=now or timezone.now()).delete()
    return deleted

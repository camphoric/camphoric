'''
The live change feed's notices (SPEC §9.8, DR-112). Whenever an admin-edited
record (camphoric.tracked) or an edit lease is saved or deleted, a notice
saying only what changed — never the record — goes out on Postgres's
`camphoric_changes` channel:

    {"type": "changed", "model": "camper", "id": 12, "event": 4,
     "action": "created" | "updated" | "deleted", "actor": {"id": 3, "name": "Reggie"}}
    {"type": "lease", "model": "registration", "id": 7, "event": 4}

It's sent with `pg_notify` inside the saving transaction, so Postgres delivers
it only once that commits (none for a rollback), and once however many times a
transaction saves the record (identical notices in a transaction collapse) —
a pricing recalculation that re-saves ten campers sends each one notice.
Admins' browsers hear it through the event's stream (camphoric.live_stream)
and fetch what they need through the API as usual.
'''

import json
import logging

from django.core.exceptions import ObjectDoesNotExist
from django.db import connection
from django.db.models.signals import m2m_changed, post_delete, post_save

from camphoric import audit, models, tracked

logger = logging.getLogger(__name__)

CHANNEL = 'camphoric_changes'


def _actor():
    user = getattr(audit.current_request(), 'user', None)
    if user is None or not user.is_authenticated:
        return None
    return {'id': user.id, 'name': user.get_full_name() or user.username}


def notify(message):
    '''Send a notice on the channel, on commit (Postgres only).'''
    if connection.vendor != 'postgresql':
        return
    with connection.cursor() as cursor:
        cursor.execute('SELECT pg_notify(%s, %s)', [CHANNEL, json.dumps(message)])


def notify_changed(instance, action='updated'):
    '''Tell the event's admins that `instance` (a tracked record) changed.'''
    try:
        event_id = tracked.event_id_of(instance)
    except ObjectDoesNotExist:
        return  # what it hangs from is already gone; its own notice says so
    if event_id is None:
        return
    notify({'type': 'changed', 'model': tracked.slug_of(instance), 'id': instance.pk,
            'event': event_id, 'action': action, 'actor': _actor()})


def _saved(sender, instance, created=False, raw=False, **kwargs):
    if raw:
        return
    if getattr(instance, 'deleted_at', None) is not None:
        action = 'deleted'
    else:
        action = 'created' if created else 'updated'
    notify_changed(instance, action)


def _deleted(sender, instance, **kwargs):
    notify_changed(instance, 'deleted')


def _lease_changed(sender, instance, raw=False, **kwargs):
    if raw:
        return
    notify({'type': 'lease', 'model': instance.content_type.model,
            'id': instance.object_id, 'event': instance.event_id})


def _promo_types_changed(sender, instance, action, **kwargs):
    if action.startswith('post_') and isinstance(instance, models.PromoCode):
        notify_changed(instance)


def connect():
    '''Send notices for every tracked model and edit leases (apps.ready).'''
    for model, _ in tracked.TRACKED.values():
        uid = f'camphoric-live-{model._meta.model_name}'
        post_save.connect(_saved, sender=model, dispatch_uid=uid)
        post_delete.connect(_deleted, sender=model, dispatch_uid=uid)
    post_save.connect(_lease_changed, sender=models.EditLease, dispatch_uid='camphoric-live-lease')
    post_delete.connect(
        _lease_changed, sender=models.EditLease, dispatch_uid='camphoric-live-lease')
    m2m_changed.connect(
        _promo_types_changed, sender=models.PromoCode.excluded_registration_types.through,
        dispatch_uid='camphoric-live-promo-types')

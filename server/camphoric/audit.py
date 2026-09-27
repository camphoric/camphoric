'''
The audit log of admin changes (SPEC §15, DR-53), kept by django-auditlog.

- Which models are tracked, and which of their fields are left out.
- Who is credited: auditlog's middleware reads the user before DRF has
  authenticated an API token, so the middleware here also credits whoever the
  view signed in by the time each entry is written.
- One id per request (auditlog's `cid`), so the entries a single save causes —
  an edit and the pricing it recalculates — can be told apart from the next.
- The history the admin reads back: each entry tags the registration and camper
  it belongs to (`get_additional_data` on those models), so a registration's
  history includes its campers, payments and charges, even ones since deleted.
'''

import json
import uuid
from contextvars import ContextVar

from auditlog.middleware import AuditlogMiddleware as BaseAuditlogMiddleware
from auditlog.models import LogEntry
from auditlog.registry import auditlog
from django.contrib.auth import get_user_model
from django.db import models as django_models
from django.db.models.signals import pre_save

_request = ContextVar('camphoric_audit_request', default=None)
_request_id = ContextVar('camphoric_audit_request_id', default=None)


def request_id():
    '''The current request's id (settings.AUDITLOG_CID_GETTER).'''
    return _request_id.get()


class AuditlogMiddleware(BaseAuditlogMiddleware):
    '''auditlog's middleware, plus a per-request id and the request for crediting (below).'''

    def __call__(self, request):
        request_token = _request.set(request)
        id_token = _request_id.set(uuid.uuid4().hex)
        try:
            return super().__call__(request)
        finally:
            _request_id.reset(id_token)
            _request.reset(request_token)


def credit_request_user(sender, instance, **kwargs):
    '''
    Credit an entry to the request's user if auditlog didn't. DRF sets the user it
    authenticates (a token, say) on the underlying request, after the middleware
    has run; by the time anything is saved, it's there.
    '''
    if instance.actor_id is not None:
        return
    user = getattr(_request.get(), 'user', None)
    if user is not None and user.is_authenticated:
        instance.actor = user
        instance.actor_email = user.email


# Every save changes these.
TIMESTAMPS = ['created_at', 'updated_at']


def register_models():
    from camphoric import models

    for model in (
        models.Organization, models.EmailAccount, models.Event, models.RegistrationType,
        models.Report, models.Invitation, models.Lodging, models.Camper,
        models.CustomChargeType, models.CustomCharge, models.Deposit, models.PricingOverride,
        models.EmailTemplate, models.EmailUnsubscribe,
    ):
        auditlog.register(model, exclude_fields=TIMESTAMPS)
    auditlog.register(models.UserAccount)
    # PayPal's replies carry the payer's details, and are written once by the
    # payment flow rather than edited.
    auditlog.register(models.Registration, exclude_fields=TIMESTAMPS + ['paypal_response'])
    auditlog.register(models.Payment, exclude_fields=TIMESTAMPS + ['paypal_order_details'])
    auditlog.register(
        get_user_model(), exclude_fields=['password', 'last_login'], m2m_fields={'groups'})

    pre_save.connect(credit_request_user, sender=LogEntry, dispatch_uid='camphoric-audit-actor')


# Reading entries back ---------------------------------------------------------

ACTIONS = {
    LogEntry.Action.CREATE: 'create',
    LogEntry.Action.UPDATE: 'update',
    LogEntry.Action.DELETE: 'delete',
}


def _decode(model, name, value):
    '''auditlog stores values as text: JSON fields as JSON, None as "None".'''
    try:
        field = model._meta.get_field(name) if model is not None else None
    except django_models.FieldDoesNotExist:
        field = None
    if isinstance(field, django_models.JSONField) and isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return value
    return None if value == 'None' else value


def _action(entry, changes):
    '''A soft delete or restore is an update to `deleted_at`; report it as one.'''
    if entry.action == LogEntry.Action.UPDATE and 'deleted_at' in changes:
        old, new = changes['deleted_at']
        if old is None and new is not None:
            return 'delete'
        if old is not None and new is None:
            return 'restore'
    return ACTIONS.get(entry.action, 'update')


def _actor(entry):
    '''Who made the change; a user since deleted by the email auditlog kept; None: no one.'''
    user = entry.actor
    if user is None:
        return {'id': None, 'username': None, 'name': entry.actor_email} \
            if entry.actor_email else None
    return {'id': user.id, 'username': user.username,
            'name': user.get_full_name() or user.username}


def describe(entry):
    model = entry.content_type.model_class()
    changes = {}
    for name, value in (entry.changes if isinstance(entry.changes, dict) else {}).items():
        if isinstance(value, (list, tuple)) and len(value) == 2:
            changes[name] = [_decode(model, name, value[0]), _decode(model, name, value[1])]
        else:
            # Many-to-many (a user's groups): {type, operation, objects}.
            changes[name] = value
    return {
        'id': entry.id,
        'timestamp': entry.timestamp,
        'request_id': entry.cid,
        'actor': _actor(entry),
        'action': _action(entry, changes),
        'object': {
            'type': entry.content_type.model,
            'id': entry.object_id,
            'label': entry.object_repr,
        },
        'changes': changes,
    }


def history(**tag):
    '''
    Entries tagged with, e.g., `registration=5` or `camper=9` (see
    `get_additional_data` in models.py), newest first.
    '''
    (key, value), = tag.items()
    entries = (LogEntry.objects
               .filter(**{f'additional_data__{key}': value})
               .select_related('actor', 'content_type')
               .order_by('-timestamp', '-id'))
    return [describe(entry) for entry in entries]


def deleted_by(instances):
    '''Who deleted each of these soft-deleted instances, by id (None: no one signed in).'''
    if not instances:
        return {}
    entries = (LogEntry.objects
               .get_for_objects(type(instances[0]).all_objects.filter(
                   pk__in=[instance.pk for instance in instances]))
               .filter(changes__has_key='deleted_at')
               .select_related('actor')
               .order_by('-timestamp', '-id'))
    result = {}
    for entry in entries:
        # The newest change to `deleted_at` is the delete: they're deleted now.
        result.setdefault(entry.object_id, _actor(entry))
    return result

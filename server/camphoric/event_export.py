'''
All of an event's data as one JSON document, for analysis with your own
scripts (SPEC §8.8, DR-169): `GET /api/events/<id>/export/`, for Registrars
and Admins.

The document starts with what describes it (`export`: the Camphoric version,
when it was made, and the event's id and name), then the
organization by id and name, then the event's own record, then one array of
records per model, in `SECTIONS` order. Every record has all its fields
(timestamps and `deleted_at` included: soft-deleted records are in it, so a
script can count them or leave them out), and every relation is the related
record's id, so the arrays can be joined back together.

What's left out (`EXCLUDED`, and every `EncryptedTextField`) are secrets: the
codes that let whoever holds them pay an invoice, register with an invitation,
finish a registration's payment step or unsubscribe an address, and the event's
PayPal client id. They're also taken out of the email messages that carried
them (`redact`). Nothing about users is in it: not who made the file, nor a
record's `created_by`, nor the test emails organizers send themselves. Nor is
anything that isn't the event's own data — the organization's records (email
accounts, contracts and the agreements to them), drafts, edit leases, API
tokens, connected apps — nor the change history.

It isn't the event import format, and isn't meant to be imported back.

It's written a record at a time from one REPEATABLE READ transaction, so every
array is from the same moment, to a temporary file (in memory while it's
small), and then sent from that file (`stream`): a large event isn't held in
memory, and a client reading slowly never holds the transaction open.
'''

import json
import re
import tempfile
from contextlib import contextmanager

from asgiref.sync import sync_to_async

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.serializers.json import DjangoJSONEncoder
from django.db import connection, transaction
from django.utils import timezone

from camphoric import models

FORMAT = 'camphoric-event-data'
FORMAT_VERSION = 1

# Fields that are secrets, by model.
EXCLUDED = {
    # Public (registrants' browsers are given it), but a credential all the same.
    models.Event: {'paypal_client_id'},
    # Anyone with it can see and pay the invoice (DR-95).
    models.Invoice: {'token'},
    # Anyone with it can register as the invitation's type.
    models.Invitation: {'invitation_code'},
    # Anyone with it can take the registration's payment step, which shows its
    # invoice's pay link (`registrationUUID`, camphoric.views.RegisterView).
    models.Registration: {'uuid'},
    # Anyone with it can unsubscribe the address (DR-48).
    models.EmailMessage: {'unsubscribe_url'},
}

REDACTED = '[redacted]'

# The link codes as they appear in the email that sent them: an invoice's pay
# link (/invoices/<token>), an invitation's (…/register?email=…&code=<code>,
# `&amp;` in HTML) and an unsubscribe link (/api/unsubscribe/<token>/).
LINK_CODES = (
    re.compile(r'(/invoices/)[A-Za-z0-9_-]+'),
    re.compile(r'([?&;]code=)[^&\s"\'<>)\]]+'),
    re.compile(r'(/api/unsubscribe/)[^/\s"\'<>)\]]+'),
)
# A uuid anywhere: a registration's, which a template may print (`registration.uuid`).
UUID = re.compile(r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b', re.I)
# A word that may be an invitation code, which a template may print on its own
# (`invitation.code`): redacted when it's one of the event's.
WORD = re.compile(r'\b[A-Za-z0-9]{8}\b')


def redact(text, invitation_codes=frozenset()):
    '''
    `text` (an email's subject or body) without the codes it carries: in links,
    any uuid, and any of `invitation_codes` (lowercase) standing on its own.
    '''
    for pattern in LINK_CODES:
        text = pattern.sub(lambda match: match.group(1) + REDACTED, text)
    text = UUID.sub(REDACTED, text)
    return WORD.sub(
        lambda match: REDACTED if match.group().lower() in invitation_codes else match.group(),
        text)


def _email_messages(event):
    invitation_codes = frozenset(
        code.lower() for code in models.Invitation.objects
        .filter(registration_type__event=event).values_list('invitation_code', flat=True))
    # A test email goes to the organizer who sent it, not to anyone at the event.
    messages = models.EmailMessage.objects.filter(event=event).exclude(
        kind=models.EmailMessageKind.TEST)
    for message in messages.order_by('id').iterator():
        for field in ('subject', 'text', 'html'):
            setattr(message, field, redact(getattr(message, field), invitation_codes))
        yield message


# (key, the event's records of that kind), in the document's order.
SECTIONS = (
    # Configuration
    ('registration_types', lambda event: models.RegistrationType.objects.filter(event=event)),
    ('promo_codes', lambda event: models.PromoCode.all_objects.filter(event=event)
        .prefetch_related('excluded_registration_types')),
    ('custom_charge_types', lambda event: models.CustomChargeType.objects.filter(event=event)),
    ('lodgings', lambda event: models.Lodging.objects.filter(event=event)),
    ('reports', lambda event: models.Report.objects.filter(event=event)),
    ('email_templates', lambda event: models.EmailTemplate.objects.filter(event=event)),
    # People and money
    ('registrations', lambda event: models.Registration.all_objects.filter(event=event)),
    ('invitations', lambda event: models.Invitation.objects.filter(
        registration_type__event=event)),
    ('campers', lambda event: models.Camper.all_objects.filter(registration__event=event)),
    ('custom_charges', lambda event: models.CustomCharge.all_objects.filter(
        custom_charge_type__event=event)),
    ('pricing_overrides', lambda event: models.PricingOverride.objects.filter(
        registration__event=event)),
    ('deposits', lambda event: models.Deposit.objects.filter(event=event)),
    ('invoices', lambda event: models.Invoice.all_objects.filter(registration__event=event)),
    ('payments', lambda event: models.Payment.all_objects.filter(registration__event=event)),
    # Email
    ('email_messages', _email_messages),
    ('email_batches', lambda event: models.EmailBatch.objects.filter(event=event)),
    ('email_unsubscribes', lambda event: models.EmailUnsubscribe.objects.filter(event=event)),
)


def record(instance):
    '''
    A record's fields, as a dict for JSON: a relation as the related record's
    id, a many-to-many relation as a list of ids, and no secret and no user
    (who made it: `created_by`).
    '''
    excluded = EXCLUDED.get(type(instance), set())
    data = {}
    for field in instance._meta.concrete_fields:
        if (field.name in excluded or isinstance(field, models.EncryptedTextField)
                or field.related_model is get_user_model()):
            continue
        # A relation's value is its id (the column, `invoice_id`), under the field's name.
        data[field.name] = field.value_from_object(instance)
    for field in instance._meta.many_to_many:
        if field.name not in excluded:
            data[field.name] = sorted(related.pk for related in getattr(instance, field.name).all())
    return data


def _records(records):
    if hasattr(records, 'iterator'):
        # Prefetches (a promo code's excluded types) are made a chunk at a time.
        records = records.order_by('id').iterator(chunk_size=500)
    return records


# The longest file name common systems allow, in UTF-8 bytes.
MAX_FILE_NAME_BYTES = 255


def file_name(event, at):
    '''
    `<event name> data <YYYY-MM-DD>.json`, the date in the event's time zone,
    with characters common systems don't allow in file names replaced (as a
    downloaded report's are, SPEC §8.7), and the event's name cut short to keep
    the whole within MAX_FILE_NAME_BYTES.
    '''
    suffix = f' data {timezone.localtime(at, event.zone):%Y-%m-%d}.json'
    name = re.sub(r'[/\\:*?"<>|\x00-\x1f\x7f-\x9f]', '-', event.name)
    name = re.sub(r'\s+', ' ', name).strip()
    room = MAX_FILE_NAME_BYTES - len(suffix.encode())
    name = name.encode()[:room].decode(errors='ignore').rstrip()
    return f'{name or f"event {event.id}"}{suffix}'


def _json(value):
    return json.dumps(value, cls=DjangoJSONEncoder, ensure_ascii=False)


@contextmanager
def _snapshot():
    '''
    A transaction in which every query sees the database as of its first: a
    REPEATABLE READ one, unless one is already open (a test's), which is used.
    '''
    if connection.in_atomic_block:
        with transaction.atomic():
            yield
        return
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
        yield


def _document(event, at):
    '''The document, as chunks of text, read from the database as it goes.'''
    event = models.Event.objects.get(pk=event.pk)
    organization = event.organization
    header = {
        'export': {
            'format': FORMAT,
            'format_version': FORMAT_VERSION,
            'camphoric_version': settings.CAMPHORIC_VERSION or None,
            'exported_at': at,
            'event': {'id': event.id, 'name': event.name},
        },
        'organization': {'id': organization.id, 'name': organization.name},
        'event': record(event),
    }
    yield _json(header)[:-1]
    for key, records_of in SECTIONS:
        yield f',\n{_json(key)}: ['
        separator = '\n'
        for instance in _records(records_of(event)):
            yield separator + _json(record(instance))
            separator = ',\n'
        yield '\n]'
    yield '\n}\n'


# The most of the document kept in memory; more goes to a temporary file.
IN_MEMORY = 1024 * 1024
CHUNK = 64 * 1024


def stream(event, at):
    '''
    The document, as chunks of text: written whole from one snapshot of the
    database (the transaction ends before the first chunk is sent), then read
    back a chunk at a time.
    '''
    with tempfile.SpooledTemporaryFile(max_size=IN_MEMORY, mode='w+', encoding='utf-8') as file:
        with _snapshot():
            for part in _document(event, at):
                file.write(part)
        file.seek(0)
        while chunk := file.read(CHUNK):
            yield chunk


def _next_batch(chunks, size=64 * 1024):
    '''The next chunks, joined, up to about `size` characters; '' once they're done.'''
    parts, length = [], 0
    for part in chunks:
        parts.append(part)
        length += len(part)
        if length >= size:
            break
    return ''.join(parts)


async def asynchronous(chunks):
    '''
    `chunks` (from `stream`) as an async iterator, for the ASGI server, which
    would otherwise read a sync one whole before sending any of it. Each batch
    is made in the request's own thread (thread-sensitive), where its database
    connection is; stopping early closes `chunks` there too.
    '''
    chunks = iter(chunks)
    try:
        while batch := await sync_to_async(_next_batch)(chunks):
            yield batch
    finally:
        close = getattr(chunks, 'close', None)
        if close is not None:
            await sync_to_async(close)()

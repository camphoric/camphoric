'''
The email outbox (SPEC DR-44).

Every outgoing email is an EmailMessage row, written when the email is queued
and kept as the record of what was sent. A `deliver_message` task (see tasks.py)
is only a wake-up: `deliver` works from the row, so a task that runs twice, late
or not at all can't send twice or lose a message.

- Queueing writes the row and its task in the caller's transaction (the
  database task backend's enqueue is transactional), so neither exists
  without the other.
- Delivery claims the row, sends through the account's mailer, and records the
  outcome. Temporary failures are retried with backoff; permanent ones fail.
- Each account's per-minute and per-day limits are checked under a row lock on
  the account, so any number of workers keep to them. Over a limit, the
  message waits (without using up an attempt).
'''

from datetime import timedelta
from email.utils import parseaddr
import logging
import smtplib
import socket

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import EmailMultiAlternatives, make_msgid
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Min, Q
from django.utils import timezone

from camphoric import models, worker
from camphoric.mail.mailers import AccountUnusable, mailer_for

logger = logging.getLogger(__name__)

Kind = models.EmailMessageKind
Status = models.EmailMessageStatus

# Seconds to wait before retrying after the 1st, 2nd, ... failed attempt; after
# the last, the message fails.
BACKOFF = [60, 5 * 60, 30 * 60, 2 * 60 * 60, 12 * 60 * 60]
MAX_ATTEMPTS = len(BACKOFF) + 1

# How long a claimed message may stay "sending" before it's presumed abandoned
# (the worker died) and queued again.
LEASE = timedelta(minutes=5)

# Task priority by kind: a registrant's confirmation goes ahead of a bulk backlog.
PRIORITY = {
    Kind.CONFIRMATION: 50,
    Kind.INVITATION: 50,
    Kind.TEST: 50,
    Kind.CONFIRMATION_REPORT: 40,
    Kind.PAGE_REPORT: 40,
    Kind.BULK: 0,
}

# Addresses at this domain are never sent to (test registrations).
DONT_SEND = '@dontsend.com'

_EVENT_ACCOUNT = object()


def enqueue(*, event, kind, to, subject, text, html='', from_email,
            account=_EVENT_ACCOUNT, reply_to=None, registration=None, invitation=None,
            dedupe_key=None, created_by=None, batch=None, template=None, recipient_key=''):
    '''
    Queue one email and wake the worker, in the caller's transaction. Returns
    the new EmailMessage, or the live one already queued under `dedupe_key`.

    `account` defaults to the event's account (None: the default mailer); a
    message without an event (an account's test) names its account.
    A message that can't be sent (a bad address, a @dontsend.com address) is
    recorded as failed or cancelled rather than queued.
    '''
    if account is _EVENT_ACCOUNT:
        account = event.email_account if event else None
    if reply_to is None:
        reply_to = account.default_reply_to if account else ''

    if dedupe_key:
        existing = _live(dedupe_key)
        if existing:
            return existing

    message = models.EmailMessage(
        event=event, kind=kind, registration=registration, invitation=invitation,
        account=account, from_email=from_email, to=to, reply_to=reply_to,
        subject=subject, text=text, html=html, dedupe_key=dedupe_key or None,
        created_by=created_by, batch=batch, template=template, recipient_key=recipient_key,
    )
    problem = _address_problem(to)
    if problem:
        message.status = Status.CANCELLED if DONT_SEND in to else Status.FAILED
        message.last_error = problem
        message.save()
        logger.warning(f'email to {to!r} not queued: {problem}')
        return message

    try:
        with transaction.atomic():
            message.save()
    except IntegrityError:
        # Another request queued the same dedupe_key first.
        existing = _live(dedupe_key)
        if existing:
            return existing
        raise
    wake(message)
    return message


def _live(dedupe_key):
    return (models.EmailMessage.objects
            .filter(dedupe_key=dedupe_key).exclude(status=Status.CANCELLED).first())


def _address_problem(to):
    address = parseaddr(to)[1]
    if DONT_SEND in address:
        return f'Not sent: {DONT_SEND} addresses are never emailed'
    try:
        validate_email(address)
    except ValidationError:
        return f'Not sent: "{to}" isn\'t a valid email address'
    return None


def wake(message, run_after=None):
    '''
    Enqueue the delivery task for `message`, at `run_after` if given. A backend
    that can't defer (immediate mode) leaves future work queued.
    '''
    from camphoric.mail.tasks import deliver_message

    task = deliver_message.using(priority=PRIORITY.get(message.kind, 0))
    if run_after is not None and run_after > timezone.now():
        if not task.get_backend().supports_defer:
            return
        task = task.using(run_after=run_after)
    task.enqueue(message.id)


def deliver(message_id):
    '''
    Try to send one queued message that's due. Returns what happened: 'sent',
    'retry', 'failed', 'throttled' or 'skipped' (not queued, or not due yet).
    '''
    now = timezone.now()
    message = (models.EmailMessage.objects.select_related('account', 'invitation')
               .filter(id=message_id).first())
    if message is None or message.status != Status.QUEUED or message.next_attempt_at > now:
        return 'skipped'

    with transaction.atomic():
        if message.account_id:
            # Serializes every worker's limit check for this account.
            models.EmailAccount.objects.select_for_update().get(id=message.account_id)
            wait_until = _throttled_until(message.account, now)
            if wait_until:
                updated = (models.EmailMessage.objects
                           .filter(id=message.id, status=Status.QUEUED)
                           .update(next_attempt_at=wait_until))
                if updated:
                    wake(message, run_after=wait_until)
                return 'throttled' if updated else 'skipped'
        # Claim it: only a queued, due message moves to "sending".
        claimed = (models.EmailMessage.objects
                   .filter(id=message.id, status=Status.QUEUED, next_attempt_at__lte=now)
                   .update(status=Status.SENDING, lease_until=now + LEASE))
    if not claimed:
        return 'skipped'
    message.refresh_from_db()

    try:
        email = _build(message)
        sent = mailer_for(message.account).send_messages([email])
        if not sent:
            raise RuntimeError('The mail server accepted no messages')
    except Exception as error:
        return _record_failure(message, error)

    message.status = Status.SENT
    message.sent_at = timezone.now()
    message.attempts += 1
    message.smtp_message_id = email.extra_headers['Message-ID']
    message.lease_until = None
    message.last_error = ''
    message.save(update_fields=['status', 'sent_at', 'attempts', 'smtp_message_id',
                                'lease_until', 'last_error', 'updated_at'])
    if message.invitation_id:
        models.Invitation.objects.filter(id=message.invitation_id).update(
            sent_time=message.sent_at)
    return 'sent'


def _throttled_until(account, now):
    '''
    When the account can next send, if one of its limits is used up now. Every
    "sending" message passed this check before it was claimed, so it counts.
    '''
    windows = [(account.max_per_minute, timedelta(minutes=1)),
               (account.max_per_day, timedelta(days=1))]
    waits = []
    for limit, window in windows:
        if not limit:
            continue
        recent = models.EmailMessage.objects.filter(account=account).filter(
            Q(status=Status.SENT, sent_at__gt=now - window) | Q(status=Status.SENDING))
        if recent.count() < limit:
            continue
        oldest = recent.filter(status=Status.SENT).aggregate(oldest=Min('sent_at'))['oldest']
        # A slot opens when the oldest send leaves the window (or, if they're all
        # still sending, soon).
        waits.append(oldest + window if oldest else now + timedelta(minutes=1))
    return max(waits) if waits else None


def _build(message):
    email = EmailMultiAlternatives(
        message.subject,
        message.text,
        message.from_email,
        [message.to],
        reply_to=[message.reply_to] if message.reply_to else None,
        headers={'Message-ID': make_msgid(domain=_msgid_domain(message.from_email))},
    )
    if message.html:
        email.attach_alternative(message.html, 'text/html')
    return email


def _msgid_domain(from_email):
    address = parseaddr(from_email)[1]
    return address.rpartition('@')[2] or None


def _record_failure(message, error):
    message.attempts += 1
    message.lease_until = None
    message.last_error = describe_error(error)
    if is_permanent(error) or message.attempts >= MAX_ATTEMPTS:
        message.status = Status.FAILED
        outcome = 'failed'
        logger.error(f'email {message.id} to {message.to} failed: {message.last_error}')
    else:
        message.status = Status.QUEUED
        message.next_attempt_at = timezone.now() + timedelta(
            seconds=BACKOFF[message.attempts - 1])
        outcome = 'retry'
        logger.warning(f'email {message.id} to {message.to} will be retried: '
                       f'{message.last_error}')
    message.save(update_fields=['attempts', 'lease_until', 'last_error', 'status',
                                'next_attempt_at', 'updated_at'])
    if outcome == 'retry':
        wake(message, run_after=message.next_attempt_at)
    return outcome


def is_permanent(error):
    '''
    Whether trying again can't help: a 5xx reply, a refused recipient, bad
    credentials, or an account that needs fixing. Connection problems, timeouts
    and 4xx replies are temporary.
    '''
    if isinstance(error, AccountUnusable):
        return True
    if isinstance(error, smtplib.SMTPRecipientsRefused):
        codes = [code for code, _ in error.recipients.values()]
        return bool(codes) and all(code >= 500 for code in codes)
    if isinstance(error, smtplib.SMTPResponseException):
        return error.smtp_code >= 500
    return False


def describe_error(error):
    if isinstance(error, smtplib.SMTPRecipientsRefused):
        text = '; '.join(f'{address}: {code} {_decode(reply)}'
                         for address, (code, reply) in error.recipients.items())
    elif isinstance(error, smtplib.SMTPResponseException):
        text = f'{error.smtp_code} {_decode(error.smtp_error)}'
    elif isinstance(error, (socket.timeout, TimeoutError)):
        text = 'Timed out talking to the mail server'
    else:
        text = str(error) or type(error).__name__
    return f'{type(error).__name__}: {text}'[:2000]


def _decode(reply):
    return reply.decode(errors='replace') if isinstance(reply, bytes) else str(reply)


# A queued message this far past due has lost its wake-up (a task that was
# never run or was cleaned up), unless a task for it is still waiting.
OVERDUE = timedelta(minutes=2)


def recover(pending_ids=None):
    '''
    Put the outbox right after a worker dies or a wake-up is lost; the
    reconciler runs this every minute. Returns (requeued, rewoken).

    - A message whose lease ran out was being sent when its worker stopped. It
      may or may not have gone out; it's tried again (at least once delivery),
      and the stopped attempt counts, so a message that kills its worker
      eventually fails instead of looping.
    - A due message that's overdue and has no waiting task (`pending_ids`, the
      message ids that do) is woken again.
    '''
    now = timezone.now()
    requeued = 0
    for message in models.EmailMessage.objects.filter(status=Status.SENDING,
                                                      lease_until__lt=now):
        message.attempts += 1
        message.lease_until = None
        message.last_error = 'The worker stopped while sending this message'
        if message.attempts >= MAX_ATTEMPTS:
            message.status = Status.FAILED
        else:
            message.status = Status.QUEUED
            message.next_attempt_at = now
        updated = (models.EmailMessage.objects
                   .filter(id=message.id, status=Status.SENDING, lease_until__lt=now)
                   .update(attempts=message.attempts, lease_until=None, status=message.status,
                           next_attempt_at=message.next_attempt_at,
                           last_error=message.last_error, updated_at=now))
        if updated and message.status == Status.QUEUED:
            requeued += 1
            wake(message)

    rewoken = 0
    pending_ids = set(pending_ids or ())
    overdue = (models.EmailMessage.objects
               .filter(status=Status.QUEUED, next_attempt_at__lt=now - OVERDUE)
               .order_by('next_attempt_at'))
    for message in overdue[:1000]:
        if message.id not in pending_ids:
            rewoken += 1
            wake(message)
    return requeued, rewoken


class NotAllowed(Exception):
    '''The message can't be retried or cancelled in its current state.'''


def retry(message):
    '''Queue a failed message to be tried again now.'''
    if message.status != Status.FAILED:
        raise NotAllowed(f'Only a failed message can be retried (this one is {message.status}).')
    problem = _address_problem(message.to)
    if problem:
        raise NotAllowed(problem)
    updated = (models.EmailMessage.objects.filter(id=message.id, status=Status.FAILED)
               .update(status=Status.QUEUED, next_attempt_at=timezone.now(), lease_until=None,
                       updated_at=timezone.now()))
    if not updated:
        raise NotAllowed('The message changed; reload it and try again.')
    message.refresh_from_db()
    wake(message)


def cancel(message):
    '''Stop a queued message from being sent.'''
    updated = (models.EmailMessage.objects.filter(id=message.id, status=Status.QUEUED)
               .update(status=Status.CANCELLED, last_error='Cancelled', updated_at=timezone.now()))
    if not updated:
        raise NotAllowed('Only a queued message can be cancelled (it may be sending already).')
    message.refresh_from_db()


def queue_state(event):
    '''What the event's email is doing now, for the admin's email history.'''
    now = timezone.now()
    messages = models.EmailMessage.objects.filter(event=event)
    queued = messages.filter(status=Status.QUEUED)
    state = {
        'queued': queued.count(),
        'sending': messages.filter(status=Status.SENDING).count(),
        'failed_last_day': messages.filter(status=Status.FAILED,
                                           updated_at__gt=now - timedelta(days=1)).count(),
        'next_attempt_at': queued.aggregate(next=Min('next_attempt_at'))['next'],
        'worker': {
            'required': settings.CAMPHORIC_EMAIL_QUEUE == 'worker',
            'alive': worker.is_alive(),
            'last_seen': worker.last_seen(),
        },
        'account': None,
    }
    account = event.email_account
    if account:
        sent = models.EmailMessage.objects.filter(account=account, status=Status.SENT)
        state['account'] = {
            'id': account.id,
            'name': account.name,
            'max_per_minute': account.max_per_minute,
            'max_per_day': account.max_per_day,
            'sent_last_minute': sent.filter(sent_at__gt=now - timedelta(minutes=1)).count(),
            'sent_last_day': sent.filter(sent_at__gt=now - timedelta(days=1)).count(),
            # When a limit is used up: the account's mail waits until then.
            'paused_until': _throttled_until(account, now),
        }
    return state

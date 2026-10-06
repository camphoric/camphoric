'''
The registrant's confirmation email, and the reports organizers get when
something about a registration goes wrong (SPEC §7.3, DR-91).

A registration is completed when the registrant presses a payment button; its
confirmation goes out when they reach a result — they chose to pay by check,
PayPal captured, or they finished without paying — or, for someone who closed
the page mid-payment, from the worker's sweep half an hour after completion.
The confirmation's dedupe key means it's only ever sent once.
'''

from datetime import timedelta
import logging

from django.utils import timezone

from camphoric import models
from camphoric.mail import outbox
from camphoric.templating.emails import confirmation_failure_report, render_confirmation_email

logger = logging.getLogger(__name__)

# How long after completion the sweep sends a confirmation nobody triggered.
CONFIRMATION_FALLBACK_DELAY = timedelta(minutes=30)


def template_sender(template, event):
    '''
    Who an email template's email comes from: its own sender, reply-to and
    account where set, else the event's address and account.
    '''
    sender = {'from_email': event.confirmation_email_from}
    if template:
        sender['from_email'] = template.sender
        if template.reply_to:
            sender['reply_to'] = template.reply_to
        if template.account_id:
            sender['account'] = template.account
    return sender


def queue_report(registration, kind, subject, body, dedupe_key=None):
    '''
    Queue a problem report to the event's "from" address, at most once per
    registration and kind (or per `dedupe_key`). Returns whether it was queued.
    '''
    event = registration.event
    if not event.confirmation_email_from:
        return False
    outbox.enqueue(
        event=event,
        kind=kind,
        registration=registration,
        from_email=event.confirmation_email_from,
        to=event.confirmation_email_from,
        subject=subject,
        text=body,
        dedupe_key=dedupe_key or f'{kind}:{registration.id}',
    )
    return True


def queue_confirmation_email(registration, request=None):
    '''
    Queue the registrant's confirmation; returns why it couldn't be, or None.
    If a Jinja template can't be rendered, the registrant is sent nothing and
    a report goes to the event's "from" address instead (SPEC §8.3, DR-38).
    '''
    event = registration.event
    rendered = render_confirmation_email(registration, request=request)
    if not rendered.ok:
        subject, body = confirmation_failure_report(registration, rendered, request=request)
        logger.error(f'{subject}\n{body}')
        queue_report(registration, models.EmailMessageKind.CONFIRMATION_REPORT, subject, body)
        return 'the confirmation email template could not be rendered'

    message = outbox.enqueue(
        event=event,
        kind=models.EmailMessageKind.CONFIRMATION,
        registration=registration,
        **template_sender(event.confirmation_template, event),
        to=registration.registrant_email,
        subject=rendered.subject,
        text=rendered.text,
        html=rendered.html,
        dedupe_key=f'confirmation:{registration.id}',
    )
    if message.status in (models.EmailMessageStatus.FAILED,
                          models.EmailMessageStatus.CANCELLED):
        return message.last_error
    return None


def send_confirmation(registration, request=None):
    '''
    Send the confirmation unless it has been already: the flow has reached a
    result, or the sweep found it overdue. Returns why it couldn't be queued,
    or None.
    '''
    if registration.confirmation_sent_at is not None:
        return None
    error = queue_confirmation_email(registration, request)
    if error:
        logger.error(f'confirmation email not queued: {error}')
    registration.confirmation_sent_at = timezone.now()
    models.Registration.all_objects.filter(pk=registration.pk).update(
        confirmation_sent_at=registration.confirmation_sent_at)
    return error


def confirmation_email_problem(registration):
    '''Whether the registration's confirmation email couldn't be queued.'''
    message = models.EmailMessage.objects.filter(
        dedupe_key=f'confirmation:{registration.id}').first()
    return message is None or message.status in (
        models.EmailMessageStatus.FAILED, models.EmailMessageStatus.CANCELLED)


def overdue_confirmations(now=None):
    '''Completed registrations whose confirmation nobody triggered in time.'''
    cutoff = (now or timezone.now()) - CONFIRMATION_FALLBACK_DELAY
    return models.Registration.objects.filter(
        completed=True, confirmation_sent_at__isnull=True, completed_at__lt=cutoff)


def send_overdue_confirmations(now=None):
    '''
    The sweep: send each overdue confirmation. Returns how many. These
    registrants pressed PayPal or Card and left without paying.
    '''
    from camphoric.invoices import clear_unpaid_online_choice  # invoices imports this module

    sent = 0
    for registration in overdue_confirmations(now).select_related('event'):
        try:
            clear_unpaid_online_choice(registration)
            send_confirmation(registration)
            sent += 1
        except Exception:
            logger.exception(f'overdue confirmation for registration {registration.id} failed')
    return sent

'''
Sending a group email (SPEC §8.9, DR-45).

The send dialog reviews exactly who gets it; `create_batch` records those
recipients and a snapshot of the template, and schedules `expand_batch` (now,
or at the send-later time). Expanding renders one copy per recipient and queues
it in the outbox (camphoric.mail.outbox), which delivers it like any other
email; the batch's progress is its messages' statuses.
'''

from dataclasses import asdict
from email.utils import formataddr

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from camphoric import models
from camphoric.mail import outbox
from camphoric.templating.bulk import Criteria, candidate_context, resolve_recipients
from camphoric.templating.emails import render_jinja_email
from camphoric.templating.graph import build_event_graph

Status = models.EmailMessageStatus
BatchStatus = models.EmailBatchStatus


class BatchError(Exception):
    '''The batch can't be sent (or changed) as asked.'''


def create_batch(template, *, recipient_keys, account=None, from_email='', reply_to='',
                 skip_already_sent=True, send_at=None, created_by=None):
    '''Record a send of `template` to the reviewed recipients and schedule it.'''
    from camphoric.mail.tasks import expand_batch

    if template.purpose != models.EmailTemplatePurpose.GROUP:
        raise BatchError('Only group emails are sent this way.')
    keys = list(dict.fromkeys(k for k in recipient_keys if isinstance(k, str) and k))
    if not keys:
        raise BatchError('Choose at least one recipient.')
    later = send_at is not None and send_at > timezone.now()
    task = expand_batch.using(run_after=send_at) if later else expand_batch
    if later and not task.get_backend().supports_defer:
        raise BatchError('Sending later needs the email worker (CAMPHORIC_EMAIL_QUEUE=worker).')

    event = template.event
    batch = models.EmailBatch.objects.create(
        event=event, template=template, name=template.name, subject=template.subject,
        body=template.body, recipient_source=template.recipient_source,
        address_expression=template.address_expression,
        name_expression=template.name_expression, recipient_list=template.recipient_list,
        recipient_keys=keys, account=account or template.account or event.email_account,
        from_email=from_email or template.sender, reply_to=reply_to or template.reply_to,
        skip_already_sent=skip_already_sent, send_at=send_at if later else None,
        created_by=created_by)
    task.enqueue(batch.id)
    batch.refresh_from_db()
    return batch


def sent_keys(template_id, *, exclude_batch=None):
    '''The recipients a template has already been sent to.'''
    sent = models.EmailMessage.objects.filter(template_id=template_id, status=Status.SENT)
    if exclude_batch is not None:
        sent = sent.exclude(batch=exclude_batch)
    return set(sent.values_list('recipient_key', flat=True))


def expand(batch_id):
    '''Render and queue one copy per recipient. Returns what happened.'''
    claimed = (models.EmailBatch.objects
               .filter(id=batch_id, status=BatchStatus.SCHEDULED)
               .update(status=BatchStatus.EXPANDING, updated_at=timezone.now()))
    if not claimed:
        return 'skipped'
    batch = models.EmailBatch.objects.select_related('event', 'account').get(id=batch_id)
    event = batch.event
    graph = build_event_graph(event)
    criteria = Criteria(
        kind=batch.recipient_source, recipient_list=batch.recipient_list,
        address_expression=batch.address_expression, name_expression=batch.name_expression,
        # A reviewed recipient may be on an incomplete registration.
        include_incomplete=True)
    resolution = resolve_recipients(event, criteria, graph=graph,
                                    only_keys=batch.recipient_keys)
    skipped = [{'key': key, 'label': key, 'reason': 'gone'} for key in resolution.missing]
    skipped += [{**asdict(s), 'key': s.camper and f'camper:{s.camper}'
                 or f'registration:{s.registration}'} for s in resolution.skipped]
    already = (sent_keys(batch.template_id, exclude_batch=batch)
               if batch.skip_already_sent and batch.template_id else set())

    created = []
    with transaction.atomic():
        for candidate in resolution.recipients:
            if candidate.key in already:
                skipped.append({'key': candidate.key, 'label': candidate.label,
                                'reason': 'already_sent'})
                continue
            rendered = render_jinja_email(
                batch.subject, batch.body,
                candidate_context(graph, batch.recipient_source, candidate))
            to = formataddr((candidate.name, candidate.email)) if candidate.name \
                else candidate.email
            fields = dict(
                event=event, kind=models.EmailMessageKind.BULK, to=to,
                subject=rendered.subject or batch.subject, text=rendered.text,
                html=rendered.html, from_email=batch.from_email, account=batch.account,
                reply_to=batch.reply_to or None, registration_id=candidate.registration,
                batch=batch, template_id=batch.template_id, recipient_key=candidate.key,
                created_by=batch.created_by, dedupe_key=f'batch:{batch.id}:{candidate.key}')
            if rendered.ok:
                created.append(_queue(fields))
            else:
                problem = rendered.errors[0]
                where = f'{problem.field} line {problem.line}: ' if problem.line else ''
                created.append(models.EmailMessage.objects.create(
                    **_message_fields(fields), status=Status.FAILED,
                    last_error=f"The email couldn't be rendered for this recipient "
                               f'({where}{problem.message})'))
        batch.skipped = skipped
        batch.save(update_fields=['skipped', 'updated_at'])
        still_expanding = (models.EmailBatch.objects
                           .filter(id=batch.id, status=BatchStatus.EXPANDING)
                           .update(status=BatchStatus.SENDING, updated_at=timezone.now()))
        if not still_expanding:
            # Cancelled while it was being prepared: nothing goes out.
            models.EmailMessage.objects.filter(batch=batch, status=Status.QUEUED).update(
                status=Status.CANCELLED, last_error='Cancelled', updated_at=timezone.now())
            return 'cancelled'
    return f'queued {sum(1 for m in created if m.status == Status.QUEUED)}'


def _message_fields(fields):
    fields = dict(fields)
    fields['reply_to'] = fields['reply_to'] or (
        fields['account'].default_reply_to if fields['account'] else '')
    return fields


def _queue(fields):
    '''Queue one copy through the outbox (address checks, dedupe, wake-up).'''
    fields = dict(fields)
    registration_id = fields.pop('registration_id')
    template_id = fields.pop('template_id')
    return outbox.enqueue(
        **fields,
        registration=models.Registration(id=registration_id) if registration_id else None,
        template=models.EmailTemplate(id=template_id) if template_id else None)


def cancel(batch):
    '''Stop a batch: before it's prepared, or its copies still waiting.'''
    updated = (models.EmailBatch.objects
               .filter(id=batch.id, status__in=[BatchStatus.SCHEDULED, BatchStatus.EXPANDING,
                                                BatchStatus.SENDING])
               .update(status=BatchStatus.CANCELLED, updated_at=timezone.now()))
    if not updated:
        raise BatchError('This batch has already been cancelled.')
    models.EmailMessage.objects.filter(batch=batch, status=Status.QUEUED).update(
        status=Status.CANCELLED, last_error='Cancelled', updated_at=timezone.now())
    batch.refresh_from_db()


def retry_failed(batch):
    '''Queue the batch's failed copies again; returns how many.'''
    retried = 0
    for message in batch.messages.filter(status=Status.FAILED):
        try:
            outbox.retry(message)
        except outbox.NotAllowed:
            continue
        retried += 1
    return retried


def with_counts(batches):
    '''Annotate batches with their messages' counts.'''
    return batches.annotate(
        total=Count('messages'),
        sent=Count('messages', filter=Q(messages__status=Status.SENT)),
        failed=Count('messages', filter=Q(messages__status=Status.FAILED)),
        cancelled=Count('messages', filter=Q(messages__status=Status.CANCELLED)),
        waiting=Count('messages',
                      filter=Q(messages__status__in=[Status.QUEUED, Status.SENDING])),
    )


def send_test(template, *, to, recipient_key=None, subject=None, body=None, created_by=None,
              criteria=None):
    '''
    Queue one copy of `template` (or its unsaved `subject` / `body`), rendered
    for a recipient — `recipient_key`, else the first its criteria reach — to
    `to`, marked [Test]. Returns (message or None, rendered, recipient).
    '''
    event = template.event
    graph = build_event_graph(event)
    criteria = criteria or Criteria.of_template(template)
    resolution = resolve_recipients(event, criteria, graph=graph)
    if not resolution.ok:
        return None, None, None
    candidates = resolution.recipients
    if recipient_key:
        chosen = next((c for c in candidates if c.key == recipient_key), None)
    else:
        chosen = candidates[0] if candidates else None
    if chosen is None:
        raise BatchError('There is no such recipient to render the test for.'
                         if recipient_key else 'The recipients list is empty.')
    rendered = render_jinja_email(
        template.subject if subject is None else subject,
        template.body if body is None else body,
        candidate_context(graph, criteria.kind, chosen))
    if not rendered.ok:
        return None, rendered, chosen
    message = outbox.enqueue(
        event=event, kind=models.EmailMessageKind.TEST, to=to,
        subject=f'[Test] {rendered.subject}', text=rendered.text, html=rendered.html,
        from_email=template.sender, account=template.account or event.email_account,
        reply_to=template.reply_to or None, created_by=created_by)
    return message, rendered, chosen

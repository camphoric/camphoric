'''
Task-based bulk email (SPEC §8.9, DR-39). It still sends directly rather than
through the outbox (camphoric.mail.outbox) until email templates replace it.
'''

import logging
import os
import time
import uuid

from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
import chevron
import cmarkgfm

from camphoric import models
from camphoric.mail.mailers import mailer_for
from camphoric.templating.bulk import recipient_context
from camphoric.templating.emails import RenderedEmail, render_jinja_email
from camphoric.templating.graph import build_event_graph


logger = logging.getLogger(__name__)


def get_email_connection_for_event(event):
    '''The email backend for sending as the event's account.'''
    return mailer_for(event.email_account)


def send_bulk_email(task):
    '''
    Given a camphoric.models.BulkEmailTask, send the message to all recipients
    to whom it has not been sent. If the task was previously run, it will be
    resumed where it left off. If the task is already running, the current run
    will be canceled and this run will resume the task (note that a duplicate
    message may be sent in this case). Returns when we've tried to send the
    message to all recipients or when the task is canceled.
    '''
    try:
        task.running_pid = os.getpid()
        task.run_uuid = uuid.uuid4()
        task.run_start_time = timezone.now()
        task.run_finish_time = None
        task.error = None
        task.save()
        if _run_bulk_email_task(task):
            task.run_finish_time = timezone.now()
    except Exception as e:
        task.error = str(e)
        raise e
    finally:
        task.running_pid = None
        task.save()


def cancel_bulk_email(task):
    '''
    Stop running the given BulkEmailTask
    '''
    task.running_pid = None
    task.save()


class BulkEmailRenderer:
    '''
    Renders one task's email for each recipient. Jinja tasks build the event's
    variable graph once per run (SPEC §8.9); Mustache tasks see only
    `recipient`, as they always have.
    '''

    def __init__(self, task):
        self.task = task
        self.graph = None
        if task.engine == models.TemplateEngine.JINJA:
            self.graph = build_event_graph(task.event)

    def render(self, recipient):
        '''A RenderedEmail for this recipient (only Jinja can have diagnostics).'''
        task = self.task
        if self.graph is not None:
            return render_jinja_email(task.subject, task.body_template,
                                      recipient_context(self.graph, task, recipient))
        body_text = chevron.render(task.body_template, {'recipient': recipient})
        return RenderedEmail(subject=task.subject, text=body_text,
                             html=cmarkgfm.github_flavored_markdown_to_html(body_text))


def _problem(rendered):
    error = rendered.errors[0]
    where = f'{error.field} line {error.line}: ' if error.line else ''
    return f'Template problem ({where}{error.message})'[:255]


def send_bulk_email_test(task, to, recipient):
    '''
    Send one copy of the task's email, rendered for `recipient`, to `to`, with
    "[Test]" in front of the subject. Returns the RenderedEmail; nothing is
    sent when it has errors.
    '''
    rendered = BulkEmailRenderer(task).render(recipient)
    if not rendered.ok:
        return rendered
    message = EmailMultiAlternatives(
        f'[Test] {rendered.subject}', rendered.text, task.from_email, [to],
        connection=get_email_connection_for_event(task.event))
    message.attach_alternative(rendered.html, 'text/html')
    message.send(fail_silently=False)
    return rendered


def _run_bulk_email_task(task):
    run_uuid = task.run_uuid
    recipients_unsent = task.recipients.filter(sent_time__isnull=True).order_by('email')
    renderer = BulkEmailRenderer(task)
    with get_email_connection_for_event(task.event) as connection:

        next_slot = None
        for recipient in recipients_unsent:
            # Pace sends against a fixed schedule (one slot per message), so the
            # time spent working and oversleeping doesn't add up across messages.
            if task.messages_per_second:
                now = time.monotonic()
                if next_slot is None or next_slot < now:
                    next_slot = now  # on (or behind) schedule: send now
                else:
                    time.sleep(next_slot - now)
                next_slot += 1 / float(task.messages_per_second)

            task.refresh_from_db()
            if task.running_pid != os.getpid() or task.run_uuid != run_uuid:
                return False

            rendered = renderer.render(recipient)
            if not rendered.ok:
                # This copy can't be rendered: note why, and go on to the next.
                recipient.error = _problem(rendered)
                recipient.save()
                continue
            message = EmailMultiAlternatives(
                rendered.subject,
                rendered.text,
                task.from_email,
                [recipient.email],
                connection=connection,
            )
            message.attach_alternative(rendered.html, 'text/html')
            sent = 0
            try:
                sent = message.send(fail_silently=False)
                if not sent:
                    raise RuntimeError('unknown error')
            except Exception as e:
                logger.error(
                    f'send_bulk_email: error sending message to {recipient.email}: {str(e)}',
                    exc_info=True)
                recipient.error = str(e)
            else:
                recipient.sent_time = timezone.now()
                recipient.error = None
            finally:
                recipient.save()

    return True

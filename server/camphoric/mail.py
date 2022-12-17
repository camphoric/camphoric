'''
Email-related functions
'''

import logging
import os
import time
import uuid

from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
import chevron
import cmarkgfm
import django.core.mail


logger = logging.getLogger(__name__)


def get_email_connection_for_event(event):
    '''
    Instantiate the email backend for the given event (camphoric.models.Event)
    to be passed as the `connection` argument of EmailMessage,
    EmailMultiAlternatives, etc.
    '''
    account = event.email_account
    if account is None:
        return django.core.mail.get_connection()

    return django.core.mail.get_connection(
        backend=account.backend,
        host=account.host,
        port=account.port,
        username=account.username,
        password=account.password,
    )


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


def _run_bulk_email_task(task):
    run_uuid = task.run_uuid
    recipients_unsent = task.recipients.filter(sent_time__isnull=True).order_by('email')
    with get_email_connection_for_event(task.event) as connection:

        for recipient in recipients_unsent:
            iteration_start_time = time.time()
            task.refresh_from_db()
            if task.running_pid != os.getpid() or task.run_uuid != run_uuid:
                return False

            body_text = chevron.render(task.body_template, {'recipient': recipient})
            body_html = cmarkgfm.github_flavored_markdown_to_html(body_text)
            message = EmailMultiAlternatives(
                task.subject,
                body_text,
                task.from_email,
                [recipient.email],
                connection=connection,
            )
            message.attach_alternative(body_html, 'text/html')
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

            if task.messages_per_second:
                target_interval = 1 / float(task.messages_per_second)
                elapsed = time.time() - iteration_start_time
                time.sleep(max(0, target_interval - elapsed))

    return True

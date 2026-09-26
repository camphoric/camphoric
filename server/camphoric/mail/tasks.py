'''
Background tasks for email (Django's Tasks API). They take ids only and do the
work in camphoric.mail.outbox, which keeps the state on the message rows.
'''

from django.tasks import task


@task(queue_name='email')
def deliver_message(message_id):
    from camphoric.mail import outbox

    return outbox.deliver(message_id)


@task(priority=10)
def expand_batch(batch_id):
    from camphoric.mail import batches

    return batches.expand(batch_id)

'''
Outgoing email.

- outbox: every email is queued as an EmailMessage row and delivered by the
  task worker (DR-43).
- mailers: the email backend for sending as an event's account.
- legacy: task-based bulk email, until email templates replace it.
'''

from camphoric.mail.legacy import (  # noqa: F401
    BulkEmailRenderer,
    cancel_bulk_email,
    get_email_connection_for_event,
    send_bulk_email,
    send_bulk_email_test,
)

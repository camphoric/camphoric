'''
Outgoing email.

- outbox: every email is queued as an EmailMessage row and delivered by the
  task worker (DR-44).
- mailers: the email backend for sending as an event's account.
- batches: sending a group email template to the recipients an admin
  reviewed (DR-45).
- tasks: the worker's email tasks.
'''

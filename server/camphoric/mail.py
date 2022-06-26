'''
Email-related functions
'''

import django.core.mail


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

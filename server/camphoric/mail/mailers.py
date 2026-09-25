'''
Email backends ("mailers") for sending as an event's EmailAccount.

Accounts live in the database, so they can't be MAILERS aliases; each backend is
built from the account's settings instead. Passing `alias` makes Django use the
options given here rather than the global email settings.
'''

from django.conf import settings
from django.core import mail
from django.utils.module_loading import import_string

SMTP_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'


class AccountUnusable(Exception):
    '''The account can't send until an organizer fixes its settings.'''


def mailer_for(account):
    '''
    A backend for sending as `account`, or the default mailer for None. With
    CAMPHORIC_EMAIL_FORCE_BACKEND set, every message goes to that backend.
    '''
    forced = settings.CAMPHORIC_EMAIL_FORCE_BACKEND
    if forced:
        return import_string(forced)(alias='camphoric-forced')
    if account is None:
        return mail.mailers.default

    alias = f'email-account-{account.pk}'
    backend = import_string(account.backend)
    if account.backend != SMTP_BACKEND:
        return backend(alias=alias)
    if account.password is None:
        raise AccountUnusable(
            f'The password for email account "{account.name}" can\'t be decrypted '
            '(the encryption key changed); enter it again.')
    return backend(
        alias=alias,
        host=account.host,
        port=account.port,
        username=account.username,
        password=account.password,
        use_tls=account.security == 'starttls',
        use_ssl=account.security == 'ssl',
        timeout=account.timeout,
    )

'''
User accounts and passwords (SPEC §6, DR-52).

- A set-password link lets someone choose their password: emailed to a new
  user, or to anyone who asks to reset theirs. It's Django's password-reset
  token, so it stops working once the password changes, the user signs in, or
  PASSWORD_RESET_TIMEOUT passes.
- A superuser can set a password for someone and require them to change it at
  their next sign-in; until they do, the API refuses everything but changing it
  (camphoric.permissions).
'''

from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from camphoric import models
from camphoric.mail import outbox
from camphoric.templating.urls import admin_url


class AccountError(Exception):
    '''The link can't be made or sent as asked.'''


# --- Must change password ---------------------------------------------------------

_UNSET = object()


def must_change_password(user):
    '''Whether the user has to choose a new password before doing anything else.'''
    if user is None or not user.is_authenticated:
        return False
    # Cached on the user object: a request checks it more than once.
    value = getattr(user, '_camphoric_must_change', _UNSET)
    if value is _UNSET:
        value = models.UserAccount.objects.filter(
            user_id=user.pk, must_change_password=True).exists()
        user._camphoric_must_change = value
    return value


def set_must_change_password(user, value):
    models.UserAccount.objects.update_or_create(
        user=user, defaults={'must_change_password': value})
    user.__dict__.pop('_camphoric_must_change', None)


def set_password(user, password, *, must_change=False):
    '''Set the password (already validated) and whether it must be changed next.'''
    user.set_password(password)
    user.save(update_fields=['password'])
    set_must_change_password(user, must_change)


# --- Set-password links -----------------------------------------------------------

def password_link(user, request=None, base=None):
    '''
    The set-password page for this user, or '' when there's no public address to
    link to (no CAMPHORIC_PUBLIC_URL, no request and no `base`).
    '''
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    path = f'/account/set-password/{uid}/{default_token_generator.make_token(user)}'
    if base:
        return f'{base.rstrip("/")}{path}'
    return admin_url(path, request)


def link_expires_at():
    return timezone.now() + timedelta(seconds=settings.PASSWORD_RESET_TIMEOUT)


def user_from_link(uidb64, token):
    '''The active user a set-password link is for, or None if it's invalid or used up.'''
    try:
        user_id = force_str(urlsafe_base64_decode(uidb64))
        user = get_user_model().objects.get(pk=user_id)
    except (TypeError, ValueError, OverflowError, get_user_model().DoesNotExist):
        return None
    if not user.is_active or not default_token_generator.check_token(user, token):
        return None
    return user


def send_password_link(user, *, request=None, created_by=None, base=None):
    '''
    Email the user a set-password link — "welcome" if they've never had a
    password, "reset" otherwise. Returns the queued EmailMessage.
    '''
    if not user.email:
        raise AccountError('This user has no email address.')
    url = password_link(user, request, base)
    if not url:
        raise AccountError('There is no public address to link to; set CAMPHORIC_PUBLIC_URL.')
    welcome = not user.has_usable_password()
    hours = round(settings.PASSWORD_RESET_TIMEOUT / 3600)
    text = render_to_string('camphoric/email/password_link.txt', {
        'user': user,
        'url': url,
        'welcome': welcome,
        'expires': f'{hours // 24} days' if hours >= 48 else f'{hours} hours',
    })
    subject = 'Set your Camphoric password' if welcome else 'Reset your Camphoric password'
    return outbox.enqueue(
        event=None, kind=models.EmailMessageKind.ACCOUNT, to=user.email, subject=subject,
        text=text, from_email=settings.DEFAULT_FROM_EMAIL, account=None, created_by=created_by)

'''
Personal access tokens for a user's own scripts (SPEC §6, DR-157 to DR-159),
such as the importer (data/). They replace /api-token-auth/ and DRF's `Token`.

- A token is `cmph_` and 43 URL-safe characters, sent as
  `Authorization: Bearer cmph_…`. Only its SHA-256 hash is stored, with its
  first characters (`prefix`) to tell it apart; the token itself is shown once,
  when it's made. The `cmph_` prefix tells it from an app's OAuth access token
  (also `Bearer`, camphoric.oauth), and lets secret scanners find committed ones.
- A user makes their own from their account (camphoric.views), or anyone with a
  shell on the server makes one for a user with `manage.py camphoric_api_token`
  (DR-158), for instance just before an import.
- A token acts as its user, with their current permission group (DR-50). A
  read-only one may only read. None may do what only a person signed in to
  Camphoric may (a view saying `people_only`, DR-159).
- A token expires when it was made to (`expires_at`), or never (null), unless
  CAMPHORIC_API_TOKEN_MAX_DAYS caps it. It ends sooner when it's revoked, when
  its user is deactivated or changes their password (camphoric.accounts).
  Expired ones are deleted nightly (camphoric.cleanup).
- A request with a token that isn't valid is refused (401) and counted against
  the client's address; past the `api_token_failure` rate, such requests get
  429. A valid token is never throttled here.
'''

import hashlib
import re
import secrets
from datetime import timedelta

from auditlog.context import disable_auditlog

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.db.models.signals import post_save
from django.utils import timezone
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication

from camphoric import models, permissions
from camphoric.throttles import ApiTokenFailureThrottle

PREFIX = 'cmph_'
# How much of a token is kept to tell it apart: the prefix and 8 random characters.
SHOWN_LENGTH = len(PREFIX) + 8
# How often `last_used_at` is updated while a token keeps being used.
LAST_USED_RESOLUTION = timedelta(hours=1)
# The longest lifetime a token may be given as a duration: past this, "never" says it.
LONGEST = timedelta(days=36500)

TOKEN_NOT_ALLOWED = 'token_not_allowed'
READ_ONLY_TOKEN = 'read_only_token'

INVALID = 'The API token is invalid, has expired or was revoked.'
RETIRED_TOKENS = (
    'Camphoric no longer accepts tokens from /api-token-auth/. Use a personal access token '
    '(Authorization: Bearer cmph_…): make one from your account, or on the server with '
    '`manage.py camphoric_api_token create <username>`.')


class TokenError(ValueError):
    '''A token can't be made as asked (its expiry); the message says why.'''


def hash_key(key):
    return hashlib.sha256(key.encode()).hexdigest()


def generate_key():
    return PREFIX + secrets.token_urlsafe(32)


def max_lifetime():
    '''The longest a token may last (CAMPHORIC_API_TOKEN_MAX_DAYS), or None: no cap.'''
    days = settings.CAMPHORIC_API_TOKEN_MAX_DAYS
    return None if days is None else timedelta(days=days)


def check_expiry(expires_at, now=None):
    '''Refuse an expiry a token can't have (TokenError): past, or beyond the cap.'''
    now = now or timezone.now()
    cap = max_lifetime()
    if expires_at is None:
        if cap is not None:
            raise TokenError(
                f'Tokens here must expire within {settings.CAMPHORIC_API_TOKEN_MAX_DAYS} days.')
        return
    if expires_at <= now:
        raise TokenError('Choose an expiry in the future.')
    if expires_at > now + LONGEST:
        raise TokenError('Choose an expiry within 100 years, or never.')
    if cap is not None and expires_at > now + cap:
        raise TokenError(
            f'Tokens here must expire within {settings.CAMPHORIC_API_TOKEN_MAX_DAYS} days.')


DURATION = re.compile(r'^(\d+)([mhdw])$')
UNITS = {'m': 'minutes', 'h': 'hours', 'd': 'days', 'w': 'weeks'}


def parse_duration(text):
    '''
    `30m`, `2h`, `7d`, `4w` → a timedelta, or `never` → None (the command's
    `--expires`). TokenError for anything else.
    '''
    text = (text or '').strip().lower()
    if text == 'never':
        return None
    match = DURATION.match(text)
    if not match or int(match.group(1)) == 0:
        raise TokenError(
            f'"{text}" isn\'t a duration: use a number and m, h, d or w (2h, 7d), or never.')
    try:
        duration = timedelta(**{UNITS[match.group(2)]: int(match.group(1))})
    except OverflowError:
        duration = None
    if duration is None or duration > LONGEST:
        raise TokenError(f'{text} is too long: use at most 100 years, or never.')
    return duration


def issue(user, name, expires_at, *, read_only=False, via=models.ApiToken.VIA_ACCOUNT):
    '''
    Make a token for the user → (the ApiToken, its key). The key is returned
    only here: what's stored is its hash.
    '''
    if not user.is_active:
        raise TokenError(f'{user.username} isn\'t active.')
    check_expiry(expires_at)
    key = generate_key()
    token = models.ApiToken(
        user=user, name=name, prefix=key[:SHOWN_LENGTH], key_hash=hash_key(key),
        read_only=read_only, created_via=via, expires_at=expires_at)
    token.save()
    return token, key


def live(tokens, now=None):
    '''The tokens that haven't expired.'''
    now = now or timezone.now()
    return tokens.filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))


def is_expired(token, now=None):
    return token.expires_at is not None and token.expires_at <= (now or timezone.now())


def revoke(token):
    '''Revoke the token: it's deleted, and the audit log records it.'''
    token.delete()


@transaction.atomic
def revoke_all(user, name=None):
    '''
    Revoke the user's tokens (only those called `name`, if given) → how many.
    One at a time, so the audit log records each.
    '''
    tokens = models.ApiToken.objects.filter(user=user)
    if name is not None:
        tokens = tokens.filter(name=name)
    count = 0
    for token in tokens:
        revoke(token)
        count += 1
    return count


def revoke_when_deactivated(sender, instance, **kwargs):
    '''Deactivating a user revokes their tokens (DR-157).'''
    if not instance.is_active:
        revoke_all(instance)


post_save.connect(
    revoke_when_deactivated, sender=get_user_model(),
    dispatch_uid='camphoric.api_tokens.revoke_when_deactivated')


def clean_up(now=None):
    '''Delete the tokens that have expired → how many (the nightly clean-up).'''
    now = now or timezone.now()
    # Not audited: a token running out isn't anyone's act, and an entry with no one
    # credited would read like a revoke.
    with disable_auditlog():
        deleted, _ = models.ApiToken.objects.filter(expires_at__lte=now).delete()
    return deleted


def note_use(token):
    '''Record that the token was used, at most once an hour.'''
    now = timezone.now()
    if token.last_used_at is None or token.last_used_at < now - LAST_USED_RESOLUTION:
        models.ApiToken.objects.filter(pk=token.pk).update(last_used_at=now)
        token.last_used_at = now


def check_token_request(token, request, view):
    '''
    Refuse (403) what a token may not do: what only a person signed in to
    Camphoric may (`people_only`), and, for a read-only token, anything that
    writes, unless the view lets read-only tokens (revoking itself). The user's
    permission group is checked after, by the view's permissions.
    '''
    if getattr(view, 'people_only', False):
        raise exceptions.PermissionDenied({
            'detail': 'An API token can\'t do this. Sign in to Camphoric to do it.',
            'code': TOKEN_NOT_ALLOWED,
        })
    if token.read_only and view is not None and not permissions.reads(request, view) and \
            not getattr(view, 'allows_read_only_tokens', False):
        raise exceptions.PermissionDenied({
            'detail': 'This API token is read-only.',
            'code': READ_ONLY_TOKEN,
        })


def _authorization(request):
    keyword, _, credentials = request.META.get('HTTP_AUTHORIZATION', '').partition(' ')
    return keyword.lower(), credentials.strip()


class ApiTokenAuthentication(BaseAuthentication):
    '''
    A personal access token (`Authorization: Bearer cmph_…`). Anything else
    is left to the next authentication class, except `Token …` (from the
    retired /api-token-auth/), which is refused with how to get a token now.
    Being the first authentication class, its challenge is the 401's: an app's
    OAuth one, which reports an OAuth failure (camphoric.oauth).
    '''

    def authenticate(self, request):
        keyword, credentials = _authorization(request)
        if keyword == 'token' and credentials:
            raise exceptions.AuthenticationFailed(RETIRED_TOKENS)
        if keyword != 'bearer' or not credentials.startswith(PREFIX):
            return None
        token = models.ApiToken.objects.select_related('user') \
            .filter(key_hash=hash_key(credentials)).first()
        if token is None or is_expired(token) or not token.user.is_active:
            if token is not None and not token.user.is_active:
                # Deactivating revokes them (above); this is the backstop.
                revoke_all(token.user)
            throttle = ApiTokenFailureThrottle()
            if not throttle.allow_request(request, None):
                raise exceptions.Throttled(throttle.wait())
            throttle.record_failure(request)
            raise exceptions.AuthenticationFailed(INVALID)
        view = (getattr(request, 'parser_context', None) or {}).get('view')
        check_token_request(token, request, view)
        note_use(token)
        return token.user, token

    def authenticate_header(self, request):
        from camphoric import oauth
        return oauth.BearerAuthentication().authenticate_header(request)

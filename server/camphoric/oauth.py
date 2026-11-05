'''
OAuth 2.0 for third-party apps (SPEC §6, DR-146 to DR-149). Camphoric is the
authorization server (django-oauth-toolkit) for the apps an Admin registers:

- An app is a confidential client, with a secret, registered redirect URIs
  matched exactly, and the authorization code grant with PKCE (S256).
- A user approves an app on the consent page (camphoric.oauth_views), which
  records the connection (`ConnectedApp`). The app then gets an access token
  that works for an hour and a refresh token that's replaced each time it's
  used; reusing a replaced one ends every token of that approval. Tokens are
  stored only as checksums.
- A request with an access token (`Authorization: Bearer …`) acts as the user
  who approved the app, and needs both the token's scope — `read` to read,
  `write` to change anything — and the user's permission group, as anyone's
  request does (camphoric.permissions). Some things only a person signed in to
  Camphoric may do, whatever the scope: a view saying `refuses_apps`.
- An app's access ends at once (every token and unused code removed, with the
  connection) when the user disconnects it, an Admin disconnects it for them or
  removes the app, the user is deactivated, or their password changes (DR-149).
'''

from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from django.db.models.signals import post_save
from django.utils import timezone
from oauth2_provider.contrib.rest_framework import OAuth2Authentication
from oauth2_provider.models import AccessToken, Grant, IDToken, RefreshToken, clear_expired
from rest_framework import exceptions

from camphoric import models, permissions
from camphoric.throttles import BearerFailureThrottle

READ = 'read'
WRITE = 'write'

# How often a connection's `last_used_at` is updated while the app keeps using it.
LAST_USED_RESOLUTION = timedelta(minutes=1)

APP_NOT_ALLOWED = 'app_not_allowed'
INSUFFICIENT_SCOPE = 'insufficient_scope'


def scope_names(scope):
    '''The scopes in a space-separated scope string, in the order the settings list them.'''
    given = set((scope or '').split())
    return [name for name in settings.OAUTH2_PROVIDER['SCOPES'] if name in given]


def required_scope(request, view):
    '''The scope a request needs: `read` to read, `write` to change anything.'''
    return READ if permissions.reads(request, view) else WRITE


def check_app_request(token, request, view):
    '''
    Refuse (403) what the token's app may not do: anything a view keeps for
    people signed in to Camphoric, and anything outside the token's scope. The
    user's permission group is checked after, by the view's permissions.
    '''
    if getattr(view, 'refuses_apps', False):
        raise exceptions.PermissionDenied({
            'detail': 'An app can\'t do this. Sign in to Camphoric to do it.',
            'code': APP_NOT_ALLOWED,
        })
    scope = required_scope(request, view)
    if not token.allow_scopes([scope]):
        raise exceptions.PermissionDenied({
            'detail': f'This app wasn\'t given the "{scope}" scope this needs.',
            'code': INSUFFICIENT_SCOPE,
        })


def note_use(token):
    '''Record that the token's app used it, at most once a minute.'''
    now = timezone.now()
    models.ConnectedApp.objects.filter(
        Q(last_used_at__isnull=True) | Q(last_used_at__lt=now - LAST_USED_RESOLUTION),
        user_id=token.user_id, application_id=token.application_id,
    ).update(last_used_at=now)


def has_bearer_token(request):
    keyword, _, credentials = request.META.get('HTTP_AUTHORIZATION', '').partition(' ')
    return keyword.lower() == 'bearer' and bool(credentials.strip())


class BearerAuthentication(OAuth2Authentication):
    '''
    An app's access token (`Authorization: Bearer …`). A token that isn't valid
    (unknown, expired or revoked) is refused with 401 and counted against the
    client's address; once too many have failed from it, requests with a token
    are refused with 429 until the window passes. A valid token is also held to
    its scope and to what apps may do (`check_app_request`).
    '''

    def authenticate(self, request):
        if not has_bearer_token(request):
            return None
        throttle = BearerFailureThrottle()
        if not throttle.allow_request(request, None):
            raise exceptions.Throttled(throttle.wait())
        result = super().authenticate(request)
        if result is None:
            throttle.record_failure(request)
            raise exceptions.AuthenticationFailed('The access token is invalid or has expired.')
        user, token = result
        if user is None:
            # A token no person approved (a grant other than the authorization code's).
            raise exceptions.AuthenticationFailed('This access token isn\'t for a person.')
        if not user.is_active:
            # Deactivating ends an app's access (DR-149); this is the backstop.
            revoke(user)
            raise exceptions.AuthenticationFailed('User inactive or deleted.')
        view = (getattr(request, 'parser_context', None) or {}).get('view')
        check_app_request(token, request, view)
        note_use(token)
        return user, token


# Connecting and disconnecting -----------------------------------------------------------

@transaction.atomic
def connect(user, application, scope, code):
    '''
    Record that the user approved the app for `scope`, with `code` the
    authorization code just issued. An earlier approval is replaced: its tokens
    and unused codes are deleted, so the app holds no more than was approved
    now, which is what the user's connected apps show (DR-149).
    '''
    pair = {'user': user, 'application': application}
    Grant.objects.filter(**pair).exclude(code=code).delete()
    RefreshToken.objects.filter(**pair).delete()
    AccessToken.objects.filter(**pair).delete()
    IDToken.objects.filter(**pair).delete()
    connection, created = models.ConnectedApp.objects.select_for_update().get_or_create(
        defaults={'scope': scope, 'approved_at': timezone.now()}, **pair)
    if not created:
        connection.scope = scope
        connection.approved_at = timezone.now()
        connection.save(update_fields=['scope', 'approved_at'])
    return connection


@transaction.atomic
def revoke(user, application=None):
    '''
    End the app's access for the user at once — every app's when `application`
    is None: their tokens and unused codes are deleted, with the connection.
    Returns whether there was a connection to remove.
    '''
    scope = {'user': user}
    if application is not None:
        scope['application'] = application
    Grant.objects.filter(**scope).delete()
    # Refresh tokens first: an access token points back at the one it came from.
    RefreshToken.objects.filter(**scope).delete()
    AccessToken.objects.filter(**scope).delete()
    IDToken.objects.filter(**scope).delete()
    connections = list(models.ConnectedApp.objects.filter(**scope))
    for connection in connections:
        # One at a time, so the audit log records each (camphoric.audit).
        connection.delete()
    return bool(connections)


def revoke_when_deactivated(sender, instance, **kwargs):
    '''Deactivating a user ends their apps' access (DR-149).'''
    if not instance.is_active:
        revoke(instance)


post_save.connect(
    revoke_when_deactivated, sender=get_user_model(),
    dispatch_uid='camphoric.oauth.revoke_when_deactivated')


# Connections left with nothing that works -----------------------------------------------

def live_tokens(connections):
    '''Annotate each connection with whether its app still holds something that works.'''
    now = timezone.now()
    refresh_lifetime = timedelta(seconds=settings.CAMPHORIC_OAUTH_REFRESH_TOKEN_TTL)
    pair = {'user_id': OuterRef('user_id'), 'application_id': OuterRef('application_id')}
    return connections.annotate(
        has_access_token=Exists(AccessToken.objects.filter(expires__gt=now, **pair)),
        has_refresh_token=Exists(RefreshToken.objects.filter(
            revoked__isnull=True, access_token__expires__gt=now - refresh_lifetime, **pair)),
        has_code=Exists(Grant.objects.filter(expires__gt=now, **pair)),
    )


def lapsed(connections):
    '''The connections whose app holds nothing that works any more.'''
    return live_tokens(connections).filter(
        has_access_token=False, has_refresh_token=False, has_code=False)


@transaction.atomic
def forget_lapsed(connections):
    '''
    Delete the connections whose app can't reach the user's account without
    being approved again; returns how many. Each is checked again as it's
    locked, so one approved again meanwhile is kept.
    '''
    count = 0
    for connection in lapsed(connections).select_for_update(of=('self',)):
        if lapsed(models.ConnectedApp.objects.filter(pk=connection.pk)).exists():
            # One at a time, so the audit log records each (camphoric.audit).
            connection.delete()
            count += 1
    return count


def forget_if_lapsed(user_id, application_id):
    '''
    After an app gave a token back, or reused a refresh token already replaced
    (which ends the approval's tokens), the connection goes too if nothing works.
    '''
    return forget_lapsed(models.ConnectedApp.objects.filter(
        user_id=user_id, application_id=application_id))


def clean_up():
    '''
    The nightly clean-up: delete expired tokens and codes (django-oauth-toolkit's
    cleartokens), then the connections left with nothing that works.
    '''
    clear_expired()
    return forget_lapsed(models.ConnectedApp.objects.all())

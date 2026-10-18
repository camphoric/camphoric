'''
API tokens that expire (SPEC §6, DR-131). Scripts such as the importer (data/)
get a token from /api-token-auth/; it works for CAMPHORIC_API_TOKEN_TTL seconds
from that sign-in. An expired token is refused (401) and deleted, and signing in
again gives a new one.
'''

from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import exceptions
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token


def token_expires_at(token):
    return token.created + timedelta(seconds=settings.CAMPHORIC_API_TOKEN_TTL)


def is_token_expired(token):
    return timezone.now() >= token_expires_at(token)


def issue_token(user):
    '''
    The user's token, good for a full lifetime from now. A token that's still
    good keeps its key, so another script signed in as the same user keeps
    working; an expired one is replaced by a new key.
    '''
    with transaction.atomic():
        token, created = Token.objects.select_for_update().get_or_create(user=user)
        if created:
            return token
        if is_token_expired(token):
            token.delete()
            return Token.objects.create(user=user)
        # `created` is set only when the row is added, so set it here by hand.
        token.created = timezone.now()
        token.save(update_fields=['created'])
        return token


class ExpiringTokenAuthentication(TokenAuthentication):
    '''DRF's token authentication, refusing (and deleting) a token past its lifetime.'''

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        if is_token_expired(token):
            # Only if no sign-in has renewed it since it was read.
            Token.objects.filter(key=token.key, created=token.created).delete()
            raise exceptions.AuthenticationFailed(_('Token has expired.'))
        return user, token

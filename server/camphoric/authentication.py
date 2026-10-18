'''
API tokens that expire (SPEC §6, DR-131). Scripts such as the importer (data/)
get a token from /api-token-auth/; it works for CAMPHORIC_API_TOKEN_TTL seconds
from when it was issued. An expired token is refused (401) and deleted. Signing
in returns a token with at least half that left, a new one when need be.
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


def has_half_its_lifetime_left(token):
    remaining = token_expires_at(token) - timezone.now()
    return remaining >= timedelta(seconds=settings.CAMPHORIC_API_TOKEN_TTL) / 2


def issue_token(user):
    '''
    The user's token, good for at least half its lifetime. A key never outlives
    its lifetime from when it was issued, however often the user signs in: a
    token with half its lifetime or more left is kept, so another script
    signed in as the user keeps working; one nearer its end, or expired, is
    replaced by a new key.
    '''
    with transaction.atomic():
        token, created = Token.objects.select_for_update().get_or_create(user=user)
        if created or has_half_its_lifetime_left(token):
            return token
        token.delete()
        return Token.objects.create(user=user)


class ExpiringTokenAuthentication(TokenAuthentication):
    '''DRF's token authentication, refusing (and deleting) a token past its lifetime.'''

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        if is_token_expired(token):
            # Only if no sign-in has renewed it since it was read.
            Token.objects.filter(key=token.key, created=token.created).delete()
            raise exceptions.AuthenticationFailed(_('Token has expired.'))
        return user, token

'''
API tokens from /api-token-auth/ expire (SPEC §6, DR-131): a token works for
CAMPHORIC_API_TOKEN_TTL seconds from its last sign-in; past that it's refused
(401) and deleted, and signing in again gives a new one.
'''

from datetime import datetime, timedelta, timezone

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import override_settings
from freezegun import freeze_time
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

TTL = 60 * 60
SIGNED_IN = datetime(2026, 6, 1, 12, 0, tzinfo=timezone.utc)


@override_settings(CAMPHORIC_API_TOKEN_TTL=TTL)
class ApiTokenTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.tom = User.objects.create_superuser('tom', 'tom@example.com', 'password')

    def setUp(self):
        cache.clear()  # the sign-in throttles' counts

    def tearDown(self):
        cache.clear()

    def sign_in(self):
        response = self.client.post(
            '/api-token-auth/', {'username': 'tom', 'password': 'password'})
        self.assertEqual(response.status_code, 200, response.data)
        return response.data['token']

    def get_events(self, key):
        return self.client.get('/api/events/', HTTP_AUTHORIZATION=f'Token {key}')

    def test_a_token_works_until_its_lifetime_ends(self):
        with freeze_time(SIGNED_IN):
            key = self.sign_in()
        with freeze_time(SIGNED_IN + timedelta(seconds=TTL - 1)):
            self.assertEqual(self.get_events(key).status_code, 200)

    def test_an_expired_token_is_refused_and_deleted(self):
        with freeze_time(SIGNED_IN):
            key = self.sign_in()
        with freeze_time(SIGNED_IN + timedelta(seconds=TTL)):
            response = self.get_events(key)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['detail'], 'Token has expired.')
        self.assertFalse(Token.objects.filter(key=key).exists())

    def test_signing_in_after_expiry_gives_a_new_token(self):
        with freeze_time(SIGNED_IN):
            old_key = self.sign_in()
        later = SIGNED_IN + timedelta(seconds=TTL + 5)
        with freeze_time(later):
            new_key = self.sign_in()
            self.assertNotEqual(new_key, old_key)
            self.assertEqual(self.get_events(new_key).status_code, 200)
            self.assertEqual(self.get_events(old_key).status_code, 401)
        self.assertEqual(list(Token.objects.filter(user=self.tom).values_list('key', flat=True)),
                         [new_key])

    def test_signing_in_while_sending_the_expired_token(self):
        # A script that keeps its Authorization header on every request.
        with freeze_time(SIGNED_IN):
            old_key = self.sign_in()
        with freeze_time(SIGNED_IN + timedelta(seconds=TTL + 5)):
            self.client.credentials(HTTP_AUTHORIZATION=f'Token {old_key}')
            new_key = self.sign_in()
        self.assertNotEqual(new_key, old_key)

    def test_signing_in_again_restarts_a_live_tokens_lifetime(self):
        # A run that signs in just before the token would expire gets its full
        # lifetime, keeping the key another script signed in as the user holds.
        with freeze_time(SIGNED_IN):
            key = self.sign_in()
        signed_in_again = SIGNED_IN + timedelta(seconds=TTL - 60)
        with freeze_time(signed_in_again):
            self.assertEqual(self.sign_in(), key)
        with freeze_time(signed_in_again + timedelta(seconds=TTL - 1)):
            self.assertEqual(self.get_events(key).status_code, 200)
        with freeze_time(signed_in_again + timedelta(seconds=TTL)):
            self.assertEqual(self.get_events(key).status_code, 401)

    def test_a_token_made_elsewhere_expires_too(self):
        # The Django admin can add tokens; they count from when they were made.
        with freeze_time(SIGNED_IN):
            token = Token.objects.create(user=self.tom)
        with freeze_time(SIGNED_IN + timedelta(seconds=TTL)):
            self.assertEqual(self.get_events(token.key).status_code, 401)

    @override_settings(CAMPHORIC_API_TOKEN_TTL=5 * TTL)
    def test_the_lifetime_comes_from_the_setting(self):
        with freeze_time(SIGNED_IN):
            key = self.sign_in()
        with freeze_time(SIGNED_IN + timedelta(seconds=5 * TTL - 1)):
            self.assertEqual(self.get_events(key).status_code, 200)

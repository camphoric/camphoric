'''
Signing in is throttled (SPEC §6, DR-124) on /api/login, /api-token-auth/ and
the Django admin's login page: every POST per client address, and failures per
username.
'''

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient, APITestCase

from camphoric.throttles import LoginAddressThrottle, LoginUsernameThrottle

LIMIT = LoginAddressThrottle().num_requests
FAILURES = LoginUsernameThrottle().num_requests


def address(i):
    return f'10.0.{i // 250}.{i % 250 + 1}'


class ThrottleTestCase(APITestCase):
    def setUp(self):
        cache.clear()  # the throttles' counts
        User.objects.create_superuser('tom', 'tom@example.com', 'password')

    def tearDown(self):
        cache.clear()

    def login(self, username, password='wrong', address='127.0.0.1', **extra):
        return self.client.post(
            '/api/login', {'username': username, 'password': password},
            format='json', REMOTE_ADDR=address, **extra)

    def fail_at_tom(self, times):
        '''Wrong passwords for tom, each from a different address.'''
        statuses = [self.login('tom', address=address(i)).status_code for i in range(times)]
        self.assertEqual(statuses, [400] * times)


class LoginThrottleTests(ThrottleTestCase):
    def test_per_address(self):
        statuses = [self.login(f'user{i}').status_code for i in range(LIMIT)]
        self.assertEqual(statuses, [400] * LIMIT)
        # Over the limit, even the right password is refused.
        response = self.login('tom', 'password')
        self.assertEqual(response.status_code, 429)
        self.assertIn('Retry-After', response)
        # Another address isn't held up.
        self.assertEqual(self.login('tom', 'password', address='10.9.9.9').status_code, 200)

    def test_only_posts_count(self):
        for _ in range(LIMIT + 1):
            self.assertEqual(self.client.get('/api/login').status_code, 405)
        self.assertEqual(self.login('tom', 'password').status_code, 200)

    def test_posts_refused_for_csrf_dont_count(self):
        client = APIClient(enforce_csrf_checks=True)
        credentials = {'username': 'tom', 'password': 'password'}
        for _ in range(LIMIT + 1):
            response = client.post('/api/login', credentials, format='json')
            self.assertEqual(response.status_code, 403)
        csrftoken = client.get('/api/set-csrf-cookie').cookies['csrftoken'].value
        response = client.post(
            '/api/login', credentials, HTTP_X_CSRFTOKEN=csrftoken, format='json')
        self.assertEqual(response.status_code, 200)

    def test_failures_per_username_across_addresses(self):
        self.fail_at_tom(FAILURES)
        # Refused even with the right password, from a new address, however
        # the username is written.
        for username in ('tom', 'TOM', 'ｔｏｍ'):
            with self.subTest(username=username):
                response = self.login(username, 'password', address='10.9.9.9')
                self.assertEqual(response.status_code, 429)
                self.assertIn('Retry-After', response)
        # Another username isn't held up.
        self.assertEqual(self.login('pat', address='10.9.9.8').status_code, 400)

    def test_signing_in_doesnt_count_against_the_username(self):
        self.fail_at_tom(FAILURES - 1)
        for i in range(3):
            self.assertEqual(self.login('tom', 'password', address=f'10.8.0.{i}').status_code, 200)
        self.assertEqual(self.login('tom', address='10.8.1.1').status_code, 400)
        self.assertEqual(self.login('tom', 'password', address='10.8.1.2').status_code, 429)

    def test_a_forged_forwarded_for_does_not_help(self):
        def attempt(i):
            return self.login(f'user{i}', HTTP_X_FORWARDED_FOR=f'192.0.2.{i}').status_code
        self.assertEqual([attempt(i) for i in range(LIMIT)], [400] * LIMIT)
        self.assertEqual(attempt(LIMIT), 429)

    @override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, 'NUM_PROXIES': 1})
    def test_behind_a_proxy_a_forged_forwarded_for_does_not_help(self):
        def attempt(i):
            # The client forges an address; the proxy appends the real one.
            forwarded = f'192.0.2.{i}, 203.0.113.5'
            return self.login(f'user{i}', HTTP_X_FORWARDED_FOR=forwarded).status_code
        self.assertEqual([attempt(i) for i in range(LIMIT)], [400] * LIMIT)
        self.assertEqual(attempt(LIMIT), 429)


class TokenThrottleTests(ThrottleTestCase):
    def token(self, username, password='wrong', address='127.0.0.1'):
        return self.client.post(
            '/api-token-auth/', {'username': username, 'password': password},
            REMOTE_ADDR=address)

    def test_per_address(self):
        response = self.token('tom', 'password')
        self.assertEqual(response.status_code, 200)
        self.assertIn('token', response.data)
        statuses = [self.token('tom').status_code for _ in range(LIMIT - 1)]
        self.assertEqual(statuses, [400] * (LIMIT - 1))
        self.assertEqual(self.token('tom', 'password').status_code, 429)

    def test_shares_the_counts_with_api_login(self):
        for i in range(LIMIT):
            self.login(f'user{i}')
        self.assertEqual(self.token('tom', 'password').status_code, 429)

        statuses = [self.token('tom', address=address(i)).status_code for i in range(FAILURES)]
        self.assertEqual(statuses, [400] * FAILURES)
        self.assertEqual(self.login('tom', 'password', address='10.9.9.9').status_code, 429)


class AdminLoginThrottleTests(TestCase):
    def setUp(self):
        cache.clear()  # the throttles' counts
        User.objects.create_superuser('tom', 'tom@example.com', 'password')

    def tearDown(self):
        cache.clear()

    def login(self, password, username='tom', address='127.0.0.1'):
        return self.client.post(
            '/django-admin/login/', {'username': username, 'password': password},
            REMOTE_ADDR=address)

    def test_per_address(self):
        # A wrong password shows the form again; the right one redirects.
        for _ in range(LIMIT + 1):
            self.assertEqual(self.client.get('/django-admin/login/').status_code, 200)
        statuses = [self.login('wrong').status_code for _ in range(LIMIT)]
        self.assertEqual(statuses, [200] * LIMIT)
        response = self.login('password')
        self.assertEqual(response.status_code, 429)
        self.assertIn('Retry-After', response)
        self.assertFalse(self.client.session.get('_auth_user_id'))

    def test_failures_per_username(self):
        statuses = [self.login('wrong', address=address(i)).status_code
                    for i in range(FAILURES)]
        self.assertEqual(statuses, [200] * FAILURES)
        # The admin signs in a full-width look-alike as tom, so it counts as tom.
        self.assertEqual(self.login('password', 'ｔｏｍ', '10.9.9.9').status_code, 429)

    def test_signs_in_under_the_limit(self):
        self.assertEqual(self.login('password', 'ｔｏｍ').status_code, 302)

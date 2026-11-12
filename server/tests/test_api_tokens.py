'''
Personal access tokens (camphoric.api_tokens, SPEC §6, DR-157 to DR-159): what
scripts sign in with, made from the account or with `manage.py
camphoric_api_token`, in place of the retired /api-token-auth/.
'''

import io
from datetime import datetime, timedelta, timezone

from auditlog.models import LogEntry
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings
from freezegun import freeze_time
from rest_framework.test import APIClient, APITestCase

from camphoric import api_tokens, models, roles
from camphoric.throttles import ApiTokenFailureThrottle
from tests.factories import make_user

NOW = datetime(2026, 11, 1, 12, 0, tzinfo=timezone.utc)


def bearer(key):
    return {'HTTP_AUTHORIZATION': f'Bearer {key}'}


class TokenTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.registrar = make_user(roles.REGISTRAR, 'rosa')
        cls.admin = make_user(roles.ADMIN, 'ada')

    def setUp(self):
        cache.clear()  # the throttles' counts

    def tearDown(self):
        cache.clear()

    def issue(self, user=None, name='script', expires_at=None, **kwargs):
        return api_tokens.issue(user or self.registrar, name, expires_at, **kwargs)

    def get(self, key, path='/api/events/'):
        return APIClient().get(path, **bearer(key))


class IssuingTests(TokenTestCase):
    def test_only_a_hash_and_a_prefix_are_kept(self):
        token, key = self.issue()
        self.assertRegex(key, r'^cmph_[A-Za-z0-9_-]{43}$')
        self.assertEqual(token.prefix, key[:13])
        self.assertEqual(token.key_hash, api_tokens.hash_key(key))
        stored = models.ApiToken.objects.values().get(pk=token.pk)
        self.assertNotIn(key, [str(value) for value in stored.values()])

    def test_each_token_is_its_own(self):
        _, one = self.issue(name='one')
        _, two = self.issue(name='two')
        self.assertNotEqual(one, two)
        self.assertEqual(self.get(one).status_code, 200)
        self.assertEqual(self.get(two).status_code, 200)

    def test_expiry_is_checked(self):
        with self.assertRaisesMessage(api_tokens.TokenError, 'in the future'):
            self.issue(expires_at=datetime(2000, 1, 1, tzinfo=timezone.utc))
        inactive = make_user(roles.REPORTER, 'gone', is_active=False)
        with self.assertRaisesMessage(api_tokens.TokenError, 'isn\'t active'):
            self.issue(inactive)

    @override_settings(CAMPHORIC_API_TOKEN_MAX_DAYS=30)
    def test_a_cap_refuses_never_and_beyond_it(self):
        with self.assertRaisesMessage(api_tokens.TokenError, 'within 30 days'):
            self.issue(expires_at=None)
        with freeze_time(NOW):
            with self.assertRaisesMessage(api_tokens.TokenError, 'within 30 days'):
                self.issue(expires_at=NOW + timedelta(days=31))
            self.issue(expires_at=NOW + timedelta(days=30))

    def test_durations(self):
        self.assertEqual(api_tokens.parse_duration('30m'), timedelta(minutes=30))
        self.assertEqual(api_tokens.parse_duration('2H'), timedelta(hours=2))
        self.assertEqual(api_tokens.parse_duration('7d'), timedelta(days=7))
        self.assertEqual(api_tokens.parse_duration('4w'), timedelta(weeks=4))
        self.assertIsNone(api_tokens.parse_duration('never'))
        for bad in ('', '0h', '2', 'h', '2y', '-1d', 'soon', '36501d', '10000000d',
                    '99999999999999999999w'):
            with self.assertRaises(api_tokens.TokenError, msg=bad):
                api_tokens.parse_duration(bad)
        self.assertEqual(api_tokens.parse_duration('36500d'), timedelta(days=36500))


class AuthenticatingTests(TokenTestCase):
    def test_a_token_acts_as_its_user_with_their_role(self):
        _, key = self.issue()
        response = self.get(key, '/api/user')
        self.assertEqual(response.data['username'], 'rosa')
        self.assertEqual(response.data['role'], roles.REGISTRAR)
        roles.set_role(self.registrar, None)
        self.assertEqual(self.get(key).status_code, 403)

    def test_last_used_is_recorded_once_an_hour(self):
        token, key = self.issue()
        with freeze_time(NOW):
            self.get(key)
        token.refresh_from_db()
        self.assertEqual(token.last_used_at, NOW)
        with freeze_time(NOW + timedelta(minutes=59)):
            self.get(key)
        token.refresh_from_db()
        self.assertEqual(token.last_used_at, NOW)
        with freeze_time(NOW + timedelta(minutes=61)):
            self.get(key)
        token.refresh_from_db()
        self.assertEqual(token.last_used_at, NOW + timedelta(minutes=61))

    def test_a_token_works_until_it_expires(self):
        with freeze_time(NOW):
            _, key = self.issue(expires_at=NOW + timedelta(hours=1))
        with freeze_time(NOW + timedelta(minutes=59)):
            self.assertEqual(self.get(key).status_code, 200)
        with freeze_time(NOW + timedelta(hours=1)):
            response = self.get(key)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['detail'], api_tokens.INVALID)

    def test_one_that_never_expires_keeps_working(self):
        _, key = self.issue(expires_at=None)
        with freeze_time(datetime(2099, 1, 1, tzinfo=timezone.utc)):
            self.assertEqual(self.get(key).status_code, 200)

    def test_revoked_unknown_and_inactive_tokens_are_refused(self):
        token, key = self.issue()
        api_tokens.revoke(token)
        self.assertEqual(self.get(key).status_code, 401)
        self.assertEqual(self.get('cmph_' + 'x' * 43).status_code, 401)
        _, key = self.issue()
        # Deactivated without the signal (a queryset update): the backstop revokes.
        type(self.registrar).objects.filter(pk=self.registrar.pk).update(is_active=False)
        self.assertEqual(self.get(key).status_code, 401)
        self.assertFalse(models.ApiToken.objects.filter(user=self.registrar).exists())

    def test_the_challenge_is_bearer(self):
        response = self.get('cmph_nope')
        self.assertEqual(response.status_code, 401)
        self.assertTrue(response['WWW-Authenticate'].startswith('Bearer'))

    def test_bad_tokens_are_throttled_per_address_but_good_ones_pass(self):
        _, key = self.issue()
        limit = ApiTokenFailureThrottle().num_requests
        statuses = [self.get(f'cmph_bad{i}').status_code for i in range(limit)]
        self.assertEqual(statuses, [401] * limit)
        self.assertEqual(self.get('cmph_bad').status_code, 429)
        self.assertEqual(self.get(key).status_code, 200)

    def test_retired_tokens_are_refused_with_how_to_get_one(self):
        response = APIClient().get('/api/events/', HTTP_AUTHORIZATION='Token 0123456789abcdef')
        self.assertEqual(response.status_code, 401)
        self.assertIn('no longer accepts tokens from /api-token-auth/', response.data['detail'])

    def test_api_token_auth_is_gone(self):
        response = APIClient().post(
            '/api-token-auth/', {'username': 'rosa', 'password': 'password'})
        self.assertEqual(response.status_code, 410)
        self.assertIn('camphoric_api_token create', response.data['detail'])


class WhatATokenMayDoTests(TokenTestCase):
    def test_a_read_only_token_only_reads(self):
        _, key = self.issue(read_only=True)
        client = APIClient()
        client.credentials(**bearer(key))
        self.assertEqual(client.get('/api/events/').status_code, 200)
        response = client.post('/api/organizations/', {'name': 'New'}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['code'], api_tokens.READ_ONLY_TOKEN)
        # It may still revoke itself.
        self.assertEqual(client.delete('/api/user/tokens/current').status_code, 204)

    def test_a_token_cant_do_what_only_a_person_may(self):
        _, key = self.issue(self.admin)
        client = APIClient()
        client.credentials(**bearer(key))
        for method, path, data in (
                ('get', '/api/user/tokens', None),
                ('post', '/api/user/tokens', {'name': 'more', 'expires_at': None}),
                ('get', '/api/user/apps', None),
                ('post', '/api/user/password',
                 {'current_password': 'password', 'new_password': 'a brand new passphrase'}),
                ('get', '/api/users/', None),
                ('get', '/api/applications/', None)):
            response = getattr(client, method)(path, data, format='json')
            self.assertEqual(response.status_code, 403, path)
            self.assertEqual(response.data['code'], api_tokens.TOKEN_NOT_ALLOWED, path)
        self.assertEqual(models.ApiToken.objects.filter(user=self.admin).count(), 1)
        self.assertTrue(self.admin.check_password('password'))

    def test_a_token_cant_agree_to_terms(self):
        from tests.test_contracts import agree, publish_contract

        organization = models.Organization.objects.create(name='Camp')
        publish_contract(organization)
        _, key = self.issue()
        client = APIClient()
        client.credentials(**bearer(key))
        response = agree(client, organization)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['code'], api_tokens.TOKEN_NOT_ALLOWED)


class MyTokensApiTests(TokenTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_login(self.registrar)

    def create(self, **data):
        return self.client.post('/api/user/tokens', {'name': 'import', **data}, format='json')

    def test_make_one_and_see_it_once(self):
        with freeze_time(NOW):
            response = self.create(expires_at='2026-11-08T12:00:00Z', read_only=True)
        self.assertEqual(response.status_code, 201, response.data)
        key = response.data['token']
        self.assertEqual(response.data['prefix'], key[:13])
        self.assertEqual(
            {name: response.data[name] for name in
             ('name', 'read_only', 'expires_at', 'last_used_at', 'created_via')},
            {'name': 'import', 'read_only': True, 'expires_at': '2026-11-08T12:00:00Z',
             'last_used_at': None, 'created_via': 'account'})
        # The token lapses on 2026-11-08, so list and use it at the frozen time.
        with freeze_time(NOW):
            listed = self.client.get('/api/user/tokens').data
            self.assertEqual(self.get(key).status_code, 200)
        self.assertEqual([token['id'] for token in listed], [response.data['id']])
        self.assertNotIn('token', listed[0])

    def test_never_must_be_chosen(self):
        response = self.client.post('/api/user/tokens', {'name': 'import'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('expires_at', response.data)
        response = self.create(expires_at=None)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data['expires_at'])

    def test_problems(self):
        self.assertIn('name', self.client.post(
            '/api/user/tokens', {'name': ' ', 'expires_at': None}, format='json').data)
        self.assertIn('name', self.create(name='x' * 101, expires_at=None).data)
        response = self.create(expires_at='2000-01-01T00:00:00Z')
        self.assertEqual(response.status_code, 400)
        self.assertIn('in the future', str(response.data['expires_at']))

    @override_settings(CAMPHORIC_API_TOKEN_MAX_DAYS=7)
    def test_a_cap(self):
        self.assertEqual(self.client.get('/api/user').data['api_token_max_days'], 7)
        response = self.create(expires_at=None)
        self.assertEqual(response.status_code, 400)
        self.assertIn('within 7 days', str(response.data['expires_at']))
        with freeze_time(NOW):
            self.assertEqual(self.create(expires_at='2026-11-09T12:00:00Z').status_code, 400)
            self.assertEqual(self.create(expires_at='2026-11-08T12:00:00Z').status_code, 201)

    def test_no_cap(self):
        self.assertIsNone(self.client.get('/api/user').data['api_token_max_days'])

    def test_only_your_live_tokens_are_listed(self):
        with freeze_time(NOW):
            mine, _ = self.issue(name='mine')
            self.issue(name='lapsed', expires_at=NOW + timedelta(minutes=1))
            self.issue(self.admin, name='theirs')
        with freeze_time(NOW + timedelta(hours=1)):
            listed = self.client.get('/api/user/tokens').data
        self.assertEqual([token['name'] for token in listed], ['mine'])

    def test_an_expired_one_not_yet_cleaned_up_can_be_revoked(self):
        with freeze_time(NOW):
            token, _ = self.issue(expires_at=NOW + timedelta(minutes=1))
        with freeze_time(NOW + timedelta(hours=1)):
            response = self.client.delete(f'/api/user/tokens/{token.pk}')
        self.assertEqual(response.status_code, 204)

    def test_an_expiry_past_a_century_is_refused(self):
        response = self.create(expires_at='2999-01-01T00:00:00Z')
        self.assertEqual(response.status_code, 400)
        self.assertIn('100 years', str(response.data['expires_at']))

    def test_revoke_one_of_yours(self):
        mine, key = self.issue()
        theirs, _ = self.issue(self.admin)
        self.assertEqual(self.client.delete(f'/api/user/tokens/{theirs.pk}').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/user/tokens/{mine.pk}').status_code, 204)
        self.assertEqual(self.get(key).status_code, 401)
        self.assertTrue(models.ApiToken.objects.filter(pk=theirs.pk).exists())

    def test_revoking_the_current_token(self):
        _, key = self.issue()
        self.assertEqual(self.client.delete('/api/user/tokens/current').status_code, 400)
        client = APIClient()
        client.credentials(**bearer(key))
        self.assertEqual(client.delete('/api/user/tokens/current').status_code, 204)
        self.assertEqual(client.get('/api/events/').status_code, 401)

    def test_no_role_no_tokens(self):
        nobody = make_user(None, 'nobody')
        self.client.force_login(nobody)
        self.assertEqual(self.client.get('/api/user/tokens').status_code, 403)


class AdminTokensApiTests(TokenTestCase):
    def test_an_admin_sees_and_revokes_a_users_tokens(self):
        token, key = self.issue()
        self.client.force_login(self.admin)
        listed = self.client.get(f'/api/users/{self.registrar.pk}/tokens/').data
        self.assertEqual([t['id'] for t in listed], [token.pk])
        response = self.client.delete(f'/api/users/{self.registrar.pk}/tokens/{token.pk}/')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.get(key).status_code, 401)
        self.assertEqual(
            self.client.delete(f'/api/users/{self.registrar.pk}/tokens/{token.pk}/').status_code,
            404)

    def test_others_dont_see_them(self):
        self.issue()
        self.client.force_login(self.registrar)
        self.assertEqual(self.client.get(f'/api/users/{self.registrar.pk}/tokens/').status_code,
                         404)

    def test_only_a_superuser_revokes_a_django_users_tokens(self):
        staff = make_user(roles.ADMIN, 'staff', django_access=roles.STAFF)
        token, _ = self.issue(staff)
        self.client.force_login(self.admin)
        self.assertEqual(len(self.client.get(f'/api/users/{staff.pk}/tokens/').data), 1)
        path = f'/api/users/{staff.pk}/tokens/{token.pk}/'
        self.assertEqual(self.client.delete(path).status_code, 404)
        root = make_user(roles.ADMIN, 'root', django_access=roles.SUPERUSER)
        self.client.force_login(root)
        self.assertEqual(self.client.delete(path).status_code, 204)


class RevokingTests(TokenTestCase):
    def test_deactivating_revokes_them(self):
        _, key = self.issue()
        self.registrar.is_active = False
        self.registrar.save()
        self.assertFalse(models.ApiToken.objects.filter(user=self.registrar).exists())
        self.assertEqual(self.get(key).status_code, 401)

    def test_a_password_change_revokes_them(self):
        _, key = self.issue()
        self.registrar.set_password('a brand new passphrase')
        self.registrar.save()
        self.assertEqual(self.get(key).status_code, 401)

    def test_publishing_terms_leaves_them(self):
        from tests.test_contracts import publish_contract

        _, key = self.issue()
        publish_contract(models.Organization.objects.create(name='Camp'), by=self.admin)
        self.assertEqual(self.get(key, '/api/user').status_code, 200)

    def test_the_nightly_clean_up_deletes_expired_ones(self):
        with freeze_time(NOW):
            self.issue(name='lapsed', expires_at=NOW + timedelta(hours=1))
            self.issue(name='later', expires_at=NOW + timedelta(days=1))
            self.issue(name='never')
        with freeze_time(NOW + timedelta(hours=2)):
            self.assertEqual(api_tokens.clean_up(), 1)
        self.assertEqual(sorted(models.ApiToken.objects.values_list('name', flat=True)),
                         ['later', 'never'])
        # Running out isn't anyone's act, so it isn't logged as a revoke.
        self.assertFalse(LogEntry.objects.filter(
            content_type=ContentType.objects.get_for_model(models.ApiToken),
            action=LogEntry.Action.DELETE).exists())


class DjangoAdminTests(TokenTestCase):
    def setUp(self):
        super().setUp()
        self.superuser = make_user(roles.ADMIN, 'root')
        self.superuser.is_staff = self.superuser.is_superuser = True
        self.superuser.save()
        self.client.force_login(self.superuser)

    def test_deleting_a_user_with_tokens_deletes_them(self):
        api_tokens.issue(self.registrar, 'import', None)
        url = f'/django-admin/auth/user/{self.registrar.pk}/delete/'
        self.assertNotContains(self.client.get(url), 'permission to delete')
        response = self.client.post(url, {'post': 'yes'})
        self.assertEqual(response.status_code, 302)
        self.assertFalse(models.ApiToken.objects.exists())
        self.assertFalse(type(self.registrar).objects.filter(pk=self.registrar.pk).exists())

    def test_a_token_is_never_changed_or_added(self):
        token, _ = api_tokens.issue(self.registrar, 'import', None)
        page = self.client.get(f'/django-admin/camphoric/apitoken/{token.pk}/change/')
        self.assertEqual(page.status_code, 200)
        self.assertNotContains(page, token.key_hash)
        self.assertEqual(self.client.get('/django-admin/camphoric/apitoken/add/').status_code, 403)
        self.client.post(f'/django-admin/camphoric/apitoken/{token.pk}/change/', {'name': 'other'})
        token.refresh_from_db()
        self.assertEqual(token.name, 'import')


class AuditTests(TokenTestCase):
    def entries(self):
        return LogEntry.objects.filter(
            content_type=ContentType.objects.get_for_model(models.ApiToken)).order_by('id')

    def test_making_and_revoking_are_audited_without_the_hash(self):
        self.client.force_login(self.registrar)
        response = self.client.post('/api/user/tokens', {'name': 'import', 'expires_at': None},
                                    format='json')
        self.client.delete(f'/api/user/tokens/{response.data["id"]}')
        created, deleted = self.entries()
        self.assertEqual((created.action, created.actor), (LogEntry.Action.CREATE, self.registrar))
        self.assertEqual((deleted.action, deleted.actor), (LogEntry.Action.DELETE, self.registrar))
        self.assertNotIn('key_hash', created.changes)
        self.assertNotIn(response.data['token'], str(created.changes))

    def test_using_one_isnt_audited(self):
        _, key = self.issue()
        before = self.entries().count()
        with freeze_time(datetime(2099, 1, 1, tzinfo=timezone.utc)):
            self.get(key)
        self.assertEqual(self.entries().count(), before)


class CommandTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.will = make_user(roles.ADMIN, 'will')

    def run_command(self, *args):
        out, err = io.StringIO(), io.StringIO()
        call_command('camphoric_api_token', *args, stdout=out, stderr=err)
        return out.getvalue(), err.getvalue()

    def test_create_prints_only_the_token(self):
        with freeze_time(NOW):
            out, err = self.run_command('create', 'will')
        key = out.strip()
        self.assertEqual(out, key + '\n')
        token = models.ApiToken.objects.get(key_hash=api_tokens.hash_key(key))
        self.assertEqual((token.user, token.name, token.created_via, token.read_only),
                         (self.will, 'manage.py', 'command', False))
        self.assertEqual(token.expires_at, NOW + timedelta(hours=1))
        self.assertIn(token.prefix, err)

    def test_create_with_options(self):
        out, _ = self.run_command(
            'create', 'will', '--name', 'import', '--expires', 'never', '--read-only')
        token = models.ApiToken.objects.get(key_hash=api_tokens.hash_key(out.strip()))
        self.assertEqual((token.name, token.expires_at, token.read_only), ('import', None, True))

    def test_replace(self):
        old, _ = self.run_command('create', 'will', '--name', 'docker-import')
        self.run_command('create', 'will', '--name', 'other')
        new, err = self.run_command('create', 'will', '--name', 'docker-import', '--replace')
        self.assertIn('Revoked 1', err)
        names = models.ApiToken.objects.filter(user=self.will).values_list('key_hash', flat=True)
        self.assertNotIn(api_tokens.hash_key(old.strip()), names)
        self.assertIn(api_tokens.hash_key(new.strip()), names)
        self.assertEqual(len(names), 2)

    def test_create_problems(self):
        make_user(roles.ADMIN, 'gone', is_active=False)
        for args, message in (
                (('create', 'nobody'), 'no user'),
                (('create', 'gone'), 'isn\'t active'),
                (('create', 'will', '--expires', 'soon'), 'isn\'t a duration'),
                (('create', 'will', '--expires', '10000000d'), 'too long'),
                (('create', 'will', '--name', ' '), 'name')):
            with self.assertRaisesMessage(CommandError, message):
                self.run_command(*args)
        self.assertFalse(models.ApiToken.objects.exists())

    @override_settings(CAMPHORIC_API_TOKEN_MAX_DAYS=30)
    def test_create_within_the_cap(self):
        with self.assertRaisesMessage(CommandError, 'within 30 days'):
            self.run_command('create', 'will', '--expires', 'never')
        with self.assertRaisesMessage(CommandError, 'within 30 days'):
            self.run_command('create', 'will', '--expires', '31d')
        self.run_command('create', 'will', '--expires', '30d')

    def test_list(self):
        self.assertIn('no tokens', self.run_command('list', 'will')[1])
        api_tokens.issue(self.will, 'import', None, read_only=True)
        out, _ = self.run_command('list', 'will')
        header, row = out.splitlines()
        self.assertIn('PREFIX', header)
        self.assertIn('import', row)
        self.assertIn('never', row)
        self.assertIn('read-only', row)

    def test_revoke(self):
        one, _ = api_tokens.issue(self.will, 'one', None)
        _, two_key = api_tokens.issue(self.will, 'two', None)
        self.run_command('revoke', one.prefix)
        self.run_command('revoke', two_key)
        self.assertFalse(models.ApiToken.objects.exists())
        api_tokens.issue(self.will, 'three', None)
        api_tokens.issue(self.will, 'four', None)
        _, err = self.run_command('revoke', '--all', 'will')
        self.assertIn('Revoked 2', err)
        self.assertFalse(models.ApiToken.objects.exists())

    def test_revoke_problems(self):
        with self.assertRaisesMessage(CommandError, 'No token'):
            self.run_command('revoke', 'cmph_nothing')
        with self.assertRaisesMessage(CommandError, 'Name a token'):
            self.run_command('revoke')
        a, _ = api_tokens.issue(self.will, 'a', None)
        b, _ = api_tokens.issue(self.will, 'b', None)
        models.ApiToken.objects.filter(pk=b.pk).update(prefix=a.prefix)
        with self.assertRaisesMessage(CommandError, '2 tokens'):
            self.run_command('revoke', a.prefix)

    def test_the_audit_log_credits_the_command(self):
        with freeze_time(NOW):
            self.run_command('create', 'will')
        entry = LogEntry.objects.get(
            content_type=ContentType.objects.get_for_model(models.ApiToken))
        self.assertIsNone(entry.actor)
        self.assertTrue(entry.actor_email.startswith('manage.py camphoric_api_token ('))

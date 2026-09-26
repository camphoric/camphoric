'''
Passwords (SPEC §6, DR-52): asking for a reset link, using a set-password link,
changing your own password, a password to be changed at the next sign-in, and
the management command.
'''

import datetime
import re
from io import StringIO
from unittest import mock

from django.contrib.auth.models import User
from django.core import mail
from django.core.cache import cache
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings
from freezegun import freeze_time
from rest_framework.test import APITestCase

from camphoric import accounts, roles
from tests.factories import make_user

GOOD_PASSWORD = 'Correct-horse-battery-9'
OTHER_PASSWORD = 'Staple-lantern-orbit-4'


def link_parts(text):
    return re.search(r'/account/set-password/([^/\s]+)/([^/\s]+)', text).groups()


class ResetRequestTests(APITestCase):
    def setUp(self):
        cache.clear()  # the throttle's counts
        self.pat = make_user(roles.REPORTER, 'pat')

    def ask(self, email):
        return self.client.post('/api/password-reset', {'email': email}, format='json')

    def test_the_same_answer_whether_or_not_the_address_has_an_account(self):
        known = self.ask('PAT@example.com')
        unknown = self.ask('nobody@example.com')
        self.assertEqual((known.status_code, unknown.status_code), (202, 202))
        self.assertEqual(known.data, unknown.data)
        [sent] = mail.outbox
        self.assertEqual(sent.to, ['pat@example.com'])
        self.assertIn('/account/set-password/', sent.body)

    def test_no_link_for_inactive_users_or_users_without_a_role(self):
        make_user(None, 'nobody', email='nobody@example.com')
        make_user(roles.REPORTER, 'gone', email='gone@example.com', is_active=False)
        self.ask('nobody@example.com')
        self.ask('gone@example.com')
        self.assertEqual(mail.outbox, [])

    def test_throttled(self):
        statuses = [self.ask('nobody@example.com').status_code for _ in range(6)]
        self.assertEqual(statuses, [202] * 5 + [429])


class SetPasswordLinkTests(APITestCase):
    def setUp(self):
        self.pat = make_user(roles.REPORTER, 'pat')
        self.uid, self.token = link_parts(accounts.password_link(self.pat, base='https://x.org'))
        self.url = f'/api/password-reset/{self.uid}/{self.token}'

    def test_check_then_set(self):
        self.assertEqual(self.client.get(self.url).data, {'username': 'pat'})
        response = self.client.post(self.url, {'new_password': GOOD_PASSWORD}, format='json')
        self.assertEqual(response.status_code, 204)
        self.assertTrue(User.objects.get(id=self.pat.id).check_password(GOOD_PASSWORD))
        # Used once, then it's done.
        self.assertEqual(self.client.get(self.url).status_code, 400)
        again = self.client.post(self.url, {'new_password': OTHER_PASSWORD}, format='json')
        self.assertEqual(again.status_code, 400)
        self.assertIn('already been used', again.data['detail'])

    def test_expired(self):
        with freeze_time(datetime.datetime.now() + datetime.timedelta(days=4)):
            self.assertEqual(self.client.get(self.url).status_code, 400)

    def test_weak_passwords_and_inactive_users(self):
        response = self.client.post(self.url, {'new_password': 'password'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('new_password', response.data)
        self.pat.is_active = False
        self.pat.save()
        self.assertEqual(self.client.get(self.url).status_code, 400)

    def test_a_bad_link(self):
        self.assertEqual(self.client.get(f'/api/password-reset/xyz/{self.token}').status_code,
                         400)


class ChangePasswordTests(APITestCase):
    def setUp(self):
        self.pat = make_user(roles.REPORTER, 'pat')
        self.client.login(username='pat', password='password')

    def change(self, current, new):
        return self.client.post('/api/user/password',
                                {'current_password': current, 'new_password': new},
                                format='json')

    def test_change_and_stay_signed_in(self):
        self.assertEqual(self.change('password', GOOD_PASSWORD).status_code, 204)
        self.assertTrue(User.objects.get(id=self.pat.id).check_password(GOOD_PASSWORD))
        self.assertEqual(self.client.get('/api/user').data['username'], 'pat')
        self.assertEqual(self.client.get('/api/events/').status_code, 200)

    def test_problems(self):
        self.assertIn('current_password', self.change('wrong', GOOD_PASSWORD).data)
        self.assertIn('new_password', self.change('password', 'pat').data)
        self.client.logout()
        self.assertIn(self.change('password', GOOD_PASSWORD).status_code, (401, 403))


class MustChangePasswordTests(APITestCase):
    def setUp(self):
        self.pat = make_user(roles.REGISTRAR, 'pat')
        accounts.set_password(self.pat, GOOD_PASSWORD, must_change=True)
        self.client.login(username='pat', password=GOOD_PASSWORD)

    def test_only_changing_it_or_signing_out_work(self):
        response = self.client.get('/api/events/')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['code'], 'password_change_required')
        me = self.client.get('/api/user').data
        self.assertTrue(me['must_change_password'])
        changed = self.client.post('/api/user/password', {
            'current_password': GOOD_PASSWORD, 'new_password': OTHER_PASSWORD}, format='json')
        self.assertEqual(changed.status_code, 204)
        self.assertFalse(self.client.get('/api/user').data['must_change_password'])
        self.assertEqual(self.client.get('/api/events/').status_code, 200)

    def test_a_set_password_link_clears_it_too(self):
        self.pat.refresh_from_db()  # signing in changed last_login, which links depend on
        uid, token = link_parts(accounts.password_link(self.pat, base='https://x.org'))
        response = self.client.post(f'/api/password-reset/{uid}/{token}',
                                    {'new_password': OTHER_PASSWORD}, format='json')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(accounts.must_change_password(User.objects.get(id=self.pat.id)))

    def test_admins_are_held_too(self):
        boss = make_user(roles.ADMIN, 'boss')
        accounts.set_password(boss, GOOD_PASSWORD, must_change=True)
        self.client.force_authenticate(user=boss)
        self.assertEqual(self.client.get('/api/users/').status_code, 403)


class CommandTests(TestCase):
    def setUp(self):
        self.pat = make_user(roles.REPORTER, 'pat')

    def run_command(self, *args):
        out = StringIO()
        call_command('camphoric_password_link', 'pat', *args, stdout=out)
        return out.getvalue()

    def test_print_and_send_a_link(self):
        output = self.run_command('--base-url', 'https://reg.example.org/')
        self.assertTrue(output.startswith('https://reg.example.org/account/set-password/'))
        self.assertEqual(mail.outbox, [])
        with override_settings(CAMPHORIC_PUBLIC_URL='https://reg.example.org'):
            self.assertIn('Emailed to pat@example.com', self.run_command('--send'))
        self.assertEqual(len(mail.outbox), 1)

    def test_problems(self):
        with self.assertRaises(CommandError):
            self.run_command()  # no site address
        with self.assertRaises(CommandError):
            call_command('camphoric_password_link', 'nobody', '--base-url', 'https://x.org')

    def test_set_a_password(self):
        with mock.patch('getpass.getpass', side_effect=[GOOD_PASSWORD, GOOD_PASSWORD]):
            self.run_command('--set', '--require-change')
        self.pat.refresh_from_db()
        self.assertTrue(self.pat.check_password(GOOD_PASSWORD))
        self.assertTrue(accounts.must_change_password(self.pat))
        with mock.patch('getpass.getpass', side_effect=['one', 'two']), \
                self.assertRaises(CommandError):
            self.run_command('--set')

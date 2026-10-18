'''
User management (SPEC DR-50, DR-52): /api/users/ for Admins — Camphoric
permission groups, Django access for superusers only, guard rails, set-password
links, and superuser-set passwords.
'''

import re

from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.test import override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from camphoric import accounts, models, roles
from tests.factories import make_user

GOOD_PASSWORD = 'Correct-horse-battery-9'


@override_settings(CAMPHORIC_PUBLIC_URL='https://reg.example.org')
class UsersApiTestCase(APITestCase):
    def setUp(self):
        self.root = User.objects.create_superuser('root', 'root@example.com', 'password')
        self.boss = make_user(roles.ADMIN, 'boss')  # an Admin who isn't a superuser

    def as_user(self, user):
        self.client.force_authenticate(user=user)

    def create(self, **fields):
        data = {'username': 'pat', 'email': 'pat@example.com', 'role': 'reporter', **fields}
        return self.client.post('/api/users/', data, format='json')


class CreateTests(UsersApiTestCase):
    def test_a_new_user_gets_a_set_password_link(self):
        self.as_user(self.boss)
        response = self.create()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['role'], 'reporter')
        self.assertFalse(response.data['has_password'])
        # Only superusers see Django access.
        self.assertNotIn('django_access', response.data)
        pat = User.objects.get(username='pat')
        self.assertEqual(list(pat.groups.values_list('name', flat=True)), ['Reporter'])
        self.assertEqual((pat.is_staff, pat.is_superuser), (False, False))
        [sent] = mail.outbox
        self.assertEqual(sent.to, ['pat@example.com'])
        self.assertEqual(sent.subject, 'Set your Camphoric password')
        self.assertIn('/account/set-password/', sent.body)
        self.assertEqual(models.EmailMessage.objects.get().kind,
                         models.EmailMessageKind.ACCOUNT)

    def test_without_a_link(self):
        self.as_user(self.boss)
        self.create(send_password_link=False)
        self.assertEqual(mail.outbox, [])

    def test_only_superusers_set_django_access_and_passwords(self):
        self.as_user(self.boss)
        response = self.create(django_access='superuser', password=GOOD_PASSWORD,
                               is_superuser=True, is_staff=True)
        self.assertEqual(response.status_code, 201, response.data)
        pat = User.objects.get(username='pat')
        self.assertEqual((pat.is_staff, pat.is_superuser), (False, False))
        self.assertFalse(pat.has_usable_password())
        self.assertEqual(len(mail.outbox), 1)

        self.as_user(self.root)
        response = self.create(username='sam', email='sam@example.com',
                               django_access='staff', password=GOOD_PASSWORD)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['django_access'], 'staff')
        sam = User.objects.get(username='sam')
        self.assertTrue(sam.is_staff)
        self.assertTrue(sam.check_password(GOOD_PASSWORD))
        self.assertTrue(accounts.must_change_password(sam))
        # A password instead of a link: nothing more is emailed.
        self.assertEqual(len(mail.outbox), 1)

    def test_a_superuser_password_must_pass_the_validators(self):
        self.as_user(self.root)
        response = self.create(password='password')
        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.data)

    def test_email_and_role_are_required_and_email_unique(self):
        self.as_user(self.boss)
        self.assertIn('email', self.create(email='').data)
        self.assertIn('role', self.client.post(
            '/api/users/', {'username': 'x', 'email': 'x@example.com'}, format='json').data)
        response = self.create(email='BOSS@example.com')
        self.assertEqual(response.status_code, 400)
        self.assertIn('already', str(response.data['email']))


class EditTests(UsersApiTestCase):
    def setUp(self):
        super().setUp()
        self.pat = make_user(roles.REPORTER, 'pat')

    def patch(self, user, **fields):
        return self.client.patch(f'/api/users/{user.id}/', fields, format='json')

    def test_changing_the_role(self):
        self.as_user(self.boss)
        response = self.patch(self.pat, role='registrar', first_name='Pat')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(roles.role_of(User.objects.get(id=self.pat.id)), roles.REGISTRAR)
        self.assertEqual(self.patch(self.pat, role=None).data['role'], None)

    def test_guard_rails(self):
        self.as_user(self.boss)
        for fields in ({'role': 'reporter'}, {'is_active': False}):
            with self.subTest(fields=fields):
                self.assertEqual(self.patch(self.boss, **fields).status_code, 409)
        self.assertEqual(self.client.delete(f'/api/users/{self.boss.id}/').status_code, 409)
        self.as_user(self.root)
        self.assertEqual(self.patch(self.root, django_access='staff').status_code, 409)
        self.assertEqual(self.patch(self.root, first_name='Root').status_code, 200)

    def test_a_superuser_is_always_an_admin(self):
        other = User.objects.create_superuser('other', 'other@example.com', 'pw')
        self.as_user(self.root)
        self.assertEqual(self.patch(other, role='reporter').status_code, 400)
        response = self.patch(other, role='reporter', django_access='regular')
        self.assertEqual(response.status_code, 200, response.data)
        other.refresh_from_db()
        self.assertEqual((other.is_superuser, roles.role_of(other)), (False, roles.REPORTER))

    def test_deactivating_signs_them_out(self):
        token = Token.objects.create(user=self.pat)
        self.as_user(self.boss)
        self.assertEqual(self.patch(self.pat, is_active=False).status_code, 200)
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/events/', HTTP_AUTHORIZATION=f'Token {token.key}')
        self.assertEqual(response.status_code, 401)
        # Their role is still shown.
        self.as_user(self.boss)
        self.assertEqual(self.client.get(f'/api/users/{self.pat.id}/').data['role'], 'reporter')


class HiddenTests(UsersApiTestCase):
    def test_hidden_from_everyone_but_admins(self):
        target = make_user(roles.REPORTER, 'pat')
        for who in (None, make_user(None), make_user(roles.REPORTER, 'rep'),
                    make_user(roles.REGISTRAR, 'reg')):
            self.as_user(who)
            with self.subTest(who=who):
                self.assertEqual(self.client.get('/api/users/').status_code, 404)
                self.assertEqual(self.create(username='z', email='z@x.org').status_code, 404)
                self.assertEqual(self.client.post(
                    f'/api/users/{target.id}/send-password-link/').status_code, 404)

    def test_setting_passwords_is_hidden_from_admins_who_arent_superusers(self):
        target = make_user(roles.REPORTER, 'pat')
        self.as_user(self.boss)
        response = self.client.post(f'/api/users/{target.id}/set-password/',
                                    {'password': GOOD_PASSWORD}, format='json')
        self.assertEqual(response.status_code, 404)

    def test_account_email_is_hidden_from_non_admins(self):
        target = make_user(roles.REPORTER, 'pat')
        accounts.send_password_link(target, base='https://reg.example.org')
        self.as_user(make_user(roles.REGISTRAR, 'reg'))
        self.assertEqual(self.client.get('/api/emailmessages/').data['count'], 0)
        self.as_user(self.boss)
        self.assertEqual(self.client.get('/api/emailmessages/').data['count'], 1)


class DjangoAccessAccountTests(UsersApiTestCase):
    '''
    Only superusers change a user with Django access (staff or superuser) or
    get a link for one (#794).
    '''

    def setUp(self):
        super().setUp()
        self.other = User.objects.create_superuser('other', 'other@example.com', 'password')
        self.dev = make_user(roles.REGISTRAR, 'dev', django_access=roles.STAFF)

    def refusals(self, target):
        url = f'/api/users/{target.id}/'
        return {
            'PATCH email': lambda: self.client.patch(
                url, {'email': 'boss2@example.com'}, format='json'),
            'PATCH deactivate': lambda: self.client.patch(
                url, {'is_active': False}, format='json'),
            'PUT': lambda: self.client.put(
                url, {'username': target.username, 'email': 'boss2@example.com',
                      'role': 'admin'}, format='json'),
            'DELETE': lambda: self.client.delete(url),
            'delete-preview': lambda: self.client.get(f'{url}delete-preview/'),
            'send-password-link': lambda: self.client.post(f'{url}send-password-link/'),
            'password-link': lambda: self.client.post(f'{url}password-link/'),
        }

    def test_admins_cant_change_delete_or_get_links_for_them(self):
        self.as_user(self.boss)
        for target in (self.root, self.dev):
            for name, request in self.refusals(target).items():
                with self.subTest(target=target.username, request=name):
                    response = request()
                    self.assertEqual(response.status_code, 404)
                    self.assertEqual(response.data['detail'],
                                     'Only a superuser can manage this account.')
            target.refresh_from_db()
            self.assertEqual((target.email, target.is_active),
                             (f'{target.username}@example.com', True))
        self.assertEqual(mail.outbox, [])
        self.assertFalse(models.EmailMessage.objects.exists())

    def test_admins_still_see_them(self):
        self.as_user(self.boss)
        usernames = [user['username'] for user in self.client.get('/api/users/').data]
        for target in (self.root, self.dev):
            self.assertIn(target.username, usernames)
            self.assertEqual(self.client.get(f'/api/users/{target.id}/').status_code, 200)
            self.assertEqual(
                self.client.get(f'/api/users/{target.id}/history/').status_code, 200)

    def test_superusers_manage_them(self):
        self.as_user(self.root)
        for target in (self.other, self.dev):
            with self.subTest(target=target.username):
                url = f'/api/users/{target.id}/'
                response = self.client.patch(url, {'first_name': 'Other'}, format='json')
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(self.client.post(f'{url}password-link/').status_code, 200)
                self.assertEqual(
                    self.client.post(f'{url}send-password-link/').status_code, 202)
                self.assertEqual(self.client.get(f'{url}delete-preview/').status_code, 200)
                self.assertEqual(self.client.delete(url).status_code, 204)
                self.assertFalse(User.objects.filter(id=target.id).exists())

    def test_a_link_stops_working_when_a_superuser_gives_django_access(self):
        for access in (roles.STAFF, roles.SUPERUSER):
            with self.subTest(access=access):
                pat = make_user(roles.ADMIN, f'pat-{access}')
                self.as_user(self.boss)
                url = self.client.post(f'/api/users/{pat.id}/password-link/').data['url']
                uid, token = re.search(
                    r'/account/set-password/([^/]+)/([^/]+)$', url).groups()
                self.as_user(self.root)
                response = self.client.patch(
                    f'/api/users/{pat.id}/', {'django_access': access}, format='json')
                self.assertEqual(response.status_code, 200, response.data)
                self.client.force_authenticate(user=None)
                self.assertEqual(
                    self.client.get(f'/api/password-reset/{uid}/{token}').status_code, 400)
                response = self.client.post(f'/api/password-reset/{uid}/{token}',
                                            {'new_password': GOOD_PASSWORD}, format='json')
                self.assertEqual(response.status_code, 400)
                self.assertFalse(User.objects.get(id=pat.id).check_password(GOOD_PASSWORD))

    def test_a_regular_users_link_is_djangos_own(self):
        # So links sent before links checked Django access still work.
        pat = make_user(roles.REPORTER, 'pat')
        self.assertTrue(accounts.token_generator.check_token(
            pat, default_token_generator.make_token(pat)))
        for user in (self.root, self.dev):
            self.assertFalse(accounts.token_generator.check_token(
                user, default_token_generator.make_token(user)))

    def test_their_account_email_is_hidden_from_admins(self):
        pat = make_user(roles.REPORTER, 'pat')
        for user in (pat, self.root, self.dev):
            accounts.send_password_link(user, base='https://reg.example.org')
        hidden = list(models.EmailMessage.objects.exclude(to='pat@example.com'))
        self.assertEqual(len(hidden), 2)
        self.as_user(self.boss)
        listed = self.client.get('/api/emailmessages/').data
        self.assertEqual([message['to'] for message in listed['results']],
                         ['pat@example.com'])
        for message in hidden:
            self.assertEqual(
                self.client.get(f'/api/emailmessages/{message.id}/').status_code, 404)
        self.as_user(self.root)
        self.assertEqual(self.client.get('/api/emailmessages/').data['count'], 3)
        for message in hidden:
            self.assertEqual(
                self.client.get(f'/api/emailmessages/{message.id}/').status_code, 200)


class LinkTests(UsersApiTestCase):
    def setUp(self):
        super().setUp()
        self.pat = make_user(roles.REPORTER, 'pat')
        self.as_user(self.boss)

    def test_send_a_link(self):
        response = self.client.post(f'/api/users/{self.pat.id}/send-password-link/')
        self.assertEqual(response.status_code, 202, response.data)
        # Queued as it's sent; the worker delivers it (here, straight after).
        self.assertEqual((response.data['to'], response.data['status']),
                         ('pat@example.com', 'queued'))
        self.assertNotIn('url', response.data)
        [sent] = mail.outbox
        # Pat has a password (the factory's), so this is a reset.
        self.assertEqual(sent.subject, 'Reset your Camphoric password')

    def test_copy_a_link(self):
        response = self.client.post(f'/api/users/{self.pat.id}/password-link/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn('expires_at', response.data)
        self.assertTrue(response.data['url'].startswith(
            'https://reg.example.org/account/set-password/'))
        uid, token = re.search(r'/account/set-password/([^/]+)/([^/]+)$',
                               response.data['url']).groups()
        self.client.force_authenticate(user=None)
        check = self.client.get(f'/api/password-reset/{uid}/{token}')
        self.assertEqual(check.data, {'username': 'pat'})

    @override_settings(CAMPHORIC_PUBLIC_URL='')
    def test_no_links_without_the_public_url(self):
        # Never from the request's host, which the request chooses (SPEC DR-116).
        with self.assertLogs('camphoric.templating.urls', 'WARNING'):
            copy = self.client.post(f'/api/users/{self.pat.id}/password-link/')
            send = self.client.post(f'/api/users/{self.pat.id}/send-password-link/')
        self.assertEqual((copy.status_code, send.status_code), (409, 409))
        self.assertIn('CAMPHORIC_PUBLIC_URL', copy.data['detail'])
        self.assertEqual(mail.outbox, [])

    def test_no_links_for_deactivated_users(self):
        self.pat.is_active = False
        self.pat.save()
        self.assertEqual(
            self.client.post(f'/api/users/{self.pat.id}/send-password-link/').status_code, 409)
        self.assertEqual(
            self.client.post(f'/api/users/{self.pat.id}/password-link/').status_code, 409)


class SetPasswordTests(UsersApiTestCase):
    def setUp(self):
        super().setUp()
        self.pat = make_user(roles.REPORTER, 'pat')
        self.as_user(self.root)

    def set_password(self, user, **data):
        return self.client.post(f'/api/users/{user.id}/set-password/', data, format='json')

    def test_set_a_password_to_change_at_next_sign_in(self):
        token = Token.objects.create(user=self.pat)
        response = self.set_password(self.pat, password=GOOD_PASSWORD)
        self.assertEqual(response.status_code, 204)
        self.pat.refresh_from_db()
        self.assertTrue(self.pat.check_password(GOOD_PASSWORD))
        self.assertTrue(accounts.must_change_password(self.pat))
        self.assertFalse(Token.objects.filter(key=token.key).exists())

    def test_without_requiring_a_change(self):
        self.set_password(self.pat, password=GOOD_PASSWORD, require_change=False)
        self.assertFalse(accounts.must_change_password(User.objects.get(id=self.pat.id)))

    def test_problems(self):
        self.assertEqual(self.set_password(self.root, password=GOOD_PASSWORD).status_code, 409)
        response = self.set_password(self.pat, password='pat')
        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.data)
        self.assertEqual(self.set_password(self.pat).status_code, 400)

'''
Camphoric permission groups (SPEC §6, DR-50): the roles themselves, the
migration that assigns them, and who may use which endpoint.
'''

from django.contrib.auth.models import AnonymousUser, Group, User
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from django.urls import URLPattern, URLResolver, get_resolver
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.test import APITestCase

from camphoric import models, roles, views
from camphoric.permissions import AdminWrites, IsAdmin, IsSuperuser, RolePermission, WritersOnly
from tests.factories import create_template_event, make_user


class RoleTests(TestCase):
    def test_role_comes_from_the_group(self):
        for role in roles.ROLES:
            self.assertEqual(roles.role_of(make_user(role)), role)
        self.assertIsNone(roles.role_of(make_user(None)))
        self.assertIsNone(roles.role_of(AnonymousUser()))

    def test_superusers_are_admins_and_inactive_users_have_none(self):
        superuser = User.objects.create_superuser('root', 'root@example.com', 'pw')
        self.assertEqual(roles.role_of(superuser), roles.ADMIN)
        inactive = make_user(roles.REGISTRAR, is_active=False)
        self.assertIsNone(roles.role_of(inactive))

    def test_set_role_keeps_one_group_and_the_django_flags(self):
        user = make_user(roles.REPORTER)
        roles.set_role(user, roles.REGISTRAR)
        self.assertEqual(list(user.groups.values_list('name', flat=True)), ['Registrar'])
        self.assertEqual(roles.role_of(user), roles.REGISTRAR)
        roles.set_role(user, None)
        self.assertFalse(user.groups.exists())
        self.assertIsNone(roles.role_of(user))
        user.refresh_from_db()
        self.assertEqual((user.is_staff, user.is_superuser), (False, False))

    def test_the_highest_group_wins(self):
        user = make_user(roles.REPORTER)
        user.groups.add(Group.objects.get(name='Registrar'))
        self.assertEqual(roles.role_of(User.objects.get(id=user.id)), roles.REGISTRAR)

    def test_django_access(self):
        user = make_user(roles.REPORTER)
        self.assertEqual(roles.django_access_of(user), roles.REGULAR)
        for level, flags in [(roles.STAFF, (True, False)), (roles.SUPERUSER, (True, True)),
                             (roles.REGULAR, (False, False))]:
            roles.set_django_access(user, level)
            user.refresh_from_db()
            self.assertEqual((user.is_staff, user.is_superuser), flags)
            self.assertEqual(roles.django_access_of(user), level)
        # Staff without a group has Django admin access but no Camphoric access.
        staff = make_user(None, django_access=roles.STAFF)
        self.assertIsNone(roles.role_of(staff))


class MigrationTests(TransactionTestCase):
    '''Migration 0069: superusers join Admin, other staff join Registrar.'''
    before = [('camphoric', '0068_email_unsubscribe')]
    after = [('camphoric', '0069_user_roles')]

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

    def test_existing_staff_get_roles(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.before)
        OldUser = executor.loader.project_state(self.before).apps.get_model('auth', 'User')
        OldUser.objects.create(username='root', is_staff=True, is_superuser=True)
        OldUser.objects.create(username='staff', is_staff=True)
        OldUser.objects.create(username='plain')

        executor = MigrationExecutor(connection)
        executor.migrate(self.after)
        names = {user.username: list(user.groups.values_list('name', flat=True))
                 for user in User.objects.all()}
        self.assertEqual(names, {'root': ['Admin'], 'staff': ['Registrar'], 'plain': []})
        self.assertTrue(User.objects.get(username='staff').is_staff)
        self.assertEqual(
            set(Group.objects.values_list('name', flat=True)), {'Admin', 'Registrar', 'Reporter'})


PUBLIC_VIEWS = {
    views.SetCSRFCookieView, views.LoginView, views.LogoutView, views.UserView,
    views.EventList, views.RegisterView, ObtainAuthToken,
    views.PasswordResetRequestView, views.PasswordResetView, views.CheckPromoCodeView,
}
# Any signed-in user, for their own account.
SELF_SERVICE = {views.ChangePasswordView}
PROTECTING = (RolePermission, AdminWrites, IsAdmin, IsSuperuser, WritersOnly)


def _drf_views(patterns):
    for pattern in patterns:
        if isinstance(pattern, URLResolver):
            yield from _drf_views(pattern.url_patterns)
        elif isinstance(pattern, URLPattern):
            cls = getattr(pattern.callback, 'cls', None)
            if cls is not None:
                yield str(pattern.pattern), cls


class PermissionAuditTests(TestCase):
    def test_every_api_view_is_protected_or_deliberately_public(self):
        for route, cls in _drf_views(get_resolver().url_patterns):
            permissions = cls.permission_classes
            with self.subTest(route=route, view=cls.__name__):
                if cls in PUBLIC_VIEWS:
                    self.assertTrue(not permissions or AllowAny in permissions)
                elif cls in SELF_SERVICE:
                    self.assertEqual(list(permissions), [IsAuthenticated])
                else:
                    self.assertTrue(permissions)
                    self.assertTrue(all(issubclass(p, PROTECTING) for p in permissions))


class PermissionMatrixTests(APITestCase):
    '''Each role against reads, read-only POSTs, writes, organizations and users.'''

    def setUp(self):
        self.made = create_template_event()
        event = self.made.event
        self.report = models.Report.objects.create(
            event=event, title='Campers', template='{{ campers | length }}', output='md',
            variables_source='server')
        self.group_email = models.EmailTemplate.objects.create(
            event=event, purpose='group', name='News', subject='News', body='Hi',
            recipient_source='campers')
        self.users = {
            'anonymous': None,
            'no role': make_user(None),
            'reporter': make_user(roles.REPORTER),
            'registrar': make_user(roles.REGISTRAR),
            'admin': make_user(roles.ADMIN),
        }

    def endpoints(self):
        e = self.made.event.id
        return {
            'read': [
                ('get', '/api/organizations/', None),
                ('get', f'/api/registrations/?event={e}', None),
                ('get', f'/api/emailmessages/?event={e}', None),
                ('get', f'/api/events/{e}/templates/check', None),
            ],
            'read-only post': [
                ('post', f'/api/events/{e}/email/recipients', {'recipient_source': 'campers'}),
                ('post', f'/api/reports/{self.report.id}/render', {}),
                ('post', f'/api/events/{e}/templates/preview',
                 {'context': 'report', 'output': 'txt', 'template': 'hi'}),
            ],
            'write': [
                ('patch', f'/api/events/{e}/', {'name': 'Renamed'}),
                ('post', '/api/reports/', {'event': e, 'title': 'New', 'template': 'x',
                                           'output': 'md', 'variables_source': 'server'}),
                ('post', f'/api/emailtemplates/{self.group_email.id}/duplicate/', {}),
                ('post', f'/api/invitations/{self.made.pending.id}/send', {}),
            ],
            'organization write': [
                ('post', '/api/organizations/', {'name': 'Another Org'}),
            ],
            'users': [
                ('get', '/api/users/', None),
            ],
        }

    # What each role gets, per kind of endpoint: 'ok' is any 2xx.
    EXPECTED = {
        'anonymous': {'read': 401, 'read-only post': 401, 'write': 401,
                      'organization write': 401, 'users': 404},
        'no role': {'read': 403, 'read-only post': 403, 'write': 403,
                    'organization write': 403, 'users': 404},
        'reporter': {'read': 'ok', 'read-only post': 'ok', 'write': 403,
                     'organization write': 403, 'users': 404},
        'registrar': {'read': 'ok', 'read-only post': 'ok', 'write': 'ok',
                      'organization write': 403, 'users': 404},
        'admin': {'read': 'ok', 'read-only post': 'ok', 'write': 'ok',
                  'organization write': 'ok', 'users': 'ok'},
    }

    def test_matrix(self):
        endpoints = self.endpoints()
        for who, user in self.users.items():
            self.client.force_authenticate(user=user)
            for kind, requests in endpoints.items():
                expected = self.EXPECTED[who][kind]
                for method, url, data in requests:
                    with self.subTest(who=who, method=method, url=url):
                        response = getattr(self.client, method)(url, data, format='json')
                        if expected == 'ok':
                            self.assertLess(response.status_code, 300, response.data)
                            self.assertGreaterEqual(response.status_code, 200)
                        else:
                            self.assertEqual(response.status_code, expected)

    def test_a_reporter_cannot_delete(self):
        self.client.force_authenticate(user=self.users['reporter'])
        self.assertEqual(self.client.delete(f'/api/reports/{self.report.id}/').status_code, 403)
        self.assertTrue(models.Report.objects.filter(id=self.report.id).exists())

    def test_whoami_says_the_role(self):
        self.client.force_authenticate(user=self.users['reporter'])
        self.assertEqual(self.client.get('/api/user').data['role'], 'reporter')
        self.client.force_authenticate(user=None)
        self.assertIsNone(self.client.get('/api/user').data['role'])


class OrganizationTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(user=make_user(roles.ADMIN))

    def test_admins_create_rename_and_delete(self):
        created = self.client.post('/api/organizations/', {'name': 'Folk Camp'}, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        url = f'/api/organizations/{created.data["id"]}/'
        self.assertEqual(self.client.patch(url, {'name': 'Folk Week'}, format='json')
                         .data['name'], 'Folk Week')
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertFalse(models.Organization.objects.filter(name='Folk Week').exists())

    def test_one_with_events_is_not_deleted(self):
        made = create_template_event()
        response = self.client.delete(f'/api/organizations/{made.organization.id}/')
        self.assertEqual(response.status_code, 409)
        self.assertIn('still has events', response.data['detail'])
        self.assertTrue(models.Organization.objects.filter(id=made.organization.id).exists())

    def test_a_name_is_required(self):
        response = self.client.post('/api/organizations/', {'name': ' '}, format='json')
        self.assertEqual(response.status_code, 400)

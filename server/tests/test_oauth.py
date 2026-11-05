'''
OAuth 2.0 for third-party apps (camphoric.oauth, SPEC §6, DR-146 to DR-149):
the authorization code flow with PKCE, the consent and sign-in pages, scopes
on top of roles, tokens' lifetimes and rotation, the ways access ends, the
throttles, the audit log, and the API for connected and registered apps.
'''

import base64
import hashlib
import os
import secrets
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlencode, urlparse

from auditlog.models import LogEntry
from django.core.cache import cache
from django.test import override_settings
from freezegun import freeze_time
from oauth2_provider.models import AccessToken, Application, Grant, RefreshToken
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from camphoric import contracts, models, oauth, roles
from camphoric import oauth_views as views_module
from camphoric.throttles import OAuthTokenThrottle
from tests.factories import create_template_event, make_user

REDIRECT_URI = 'https://admin-tool.example.com/oauth/callback'
SECRET = 'the-app-secret'
NOW = datetime(2026, 6, 1, 12, 0, tzinfo=timezone.utc)


def pkce_pair():
    verifier = secrets.token_urlsafe(48)
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b'=').decode()
    return verifier, challenge


class OAuthTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()
        cls.admin = make_user(roles.ADMIN, 'admin')
        cls.registrar = make_user(roles.REGISTRAR, 'registrar')
        cls.reporter = make_user(roles.REPORTER, 'reporter')
        cls.app = Application.objects.create(
            name='Lark admin tool', client_type=Application.CLIENT_CONFIDENTIAL,
            authorization_grant_type=Application.GRANT_AUTHORIZATION_CODE,
            redirect_uris=REDIRECT_URI, client_secret=SECRET, hash_client_secret=True)

    def setUp(self):
        cache.clear()  # the throttles' counts

    def tearDown(self):
        cache.clear()

    def authorize_query(self, scope='read write', challenge=None, **more):
        query = {
            'response_type': 'code', 'client_id': self.app.client_id,
            'redirect_uri': REDIRECT_URI, 'state': 'xyz',
        }
        if scope is not None:
            query['scope'] = scope
        if challenge:
            query.update(code_challenge=challenge, code_challenge_method='S256')
        query.update(more)
        return f'/o/authorize/?{urlencode(query)}'

    def approve(self, user, scope='read write', redirect_uri=REDIRECT_URI):
        '''Sign in as `user`, approve the app for `scope`, and return the code and verifier.'''
        verifier, challenge = pkce_pair()
        self.client.force_login(user)
        url = self.authorize_query(scope, challenge, redirect_uri=redirect_uri)
        page = self.client.get(url)
        self.assertEqual(page.status_code, 200, page.content)
        form = page.context['form']
        data = {name: value for name, value in form.initial.items() if value is not None}
        data['allow'] = 'Authorize'
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 302, response.content)
        location = urlparse(response['Location'])
        self.assertEqual(f'{location.scheme}://{location.netloc}{location.path}',
                         redirect_uri.partition('?')[0])
        query = parse_qs(location.query)
        self.assertEqual(query['state'], ['xyz'])
        self.client.logout()
        return query['code'][-1], verifier

    def exchange(self, code, verifier, secret=SECRET):
        return self.client.post('/o/token/', {
            'grant_type': 'authorization_code', 'code': code, 'redirect_uri': REDIRECT_URI,
            'client_id': self.app.client_id, 'client_secret': secret,
            'code_verifier': verifier,
        })

    def connect(self, user, scope='read write'):
        '''The tokens an app gets once `user` approves it for `scope`.'''
        response = self.exchange(*self.approve(user, scope))
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def refresh(self, refresh_token, secret=SECRET):
        return self.client.post('/o/token/', {
            'grant_type': 'refresh_token', 'refresh_token': refresh_token,
            'client_id': self.app.client_id, 'client_secret': secret,
        })

    def api(self, method, path, token, data=None):
        return getattr(self.client, method)(
            path, data, format='json', HTTP_AUTHORIZATION=f'Bearer {token}')


class AuthorizationFlowTests(OAuthTestCase):
    def test_a_signed_out_user_signs_in_then_sees_the_consent_page(self):
        _, challenge = pkce_pair()
        url = self.authorize_query(challenge=challenge)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response['Location'].startswith('/o/login/?next='))

        login = self.client.get(response['Location'])
        self.assertEqual(login.status_code, 200)
        signed_in = self.client.post(response['Location'], {
            'username': 'registrar', 'password': 'password', 'next': url})
        self.assertEqual(signed_in.status_code, 302)
        self.assertEqual(signed_in['Location'], url)

        consent = self.client.get(url)
        self.assertContains(consent, 'Lark admin tool')
        self.assertContains(consent, 'registrar')
        self.assertContains(consent, 'Make the changes your Camphoric permission group')

    def test_signing_in_goes_nowhere_but_the_consent_page(self):
        response = self.client.post('/o/login/', {
            'username': 'registrar', 'password': 'password',
            'next': 'https://evil.example.com/'})
        self.assertEqual(response['Location'], '/admin')
        self.client.logout()
        response = self.client.post('/o/login/', {
            'username': 'registrar', 'password': 'password', 'next': '/admin/users'})
        self.assertEqual(response['Location'], '/admin')

    def test_a_wrong_password_is_refused_and_throttled(self):
        for _ in range(10):
            self.client.post('/o/login/', {'username': 'registrar', 'password': 'wrong'})
        self.assertEqual(self.client.post(
            '/o/login/', {'username': 'registrar', 'password': 'password'}).status_code, 429)

    def test_approving_gives_the_app_tokens_for_the_user(self):
        with freeze_time(NOW):
            tokens = self.connect(self.registrar)
        self.assertEqual(tokens['token_type'], 'Bearer')
        self.assertEqual(tokens['expires_in'], 3600)
        self.assertEqual(set(tokens['scope'].split()), {'read', 'write'})
        connection = models.ConnectedApp.objects.get(user=self.registrar)
        self.assertEqual((connection.application, connection.scope, connection.approved_at),
                         (self.app, 'read write', NOW))
        # Only checksums are stored.
        self.assertEqual(AccessToken.objects.get(user=self.registrar).token, '')
        self.assertEqual(RefreshToken.objects.get(user=self.registrar).token, '')

        with freeze_time(NOW + timedelta(minutes=5)):
            response = self.api('get', '/api/user', tokens['access_token'])
        self.assertEqual(response.data['username'], 'registrar')

    def test_an_app_that_asks_for_no_scope_gets_read(self):
        tokens = self.connect(self.registrar, scope=None)
        self.assertEqual(tokens['scope'], 'read')
        self.assertEqual(models.ConnectedApp.objects.get(user=self.registrar).scope, 'read')

    def test_cancelling_gives_the_app_nothing(self):
        verifier, challenge = pkce_pair()
        self.client.force_login(self.registrar)
        url = self.authorize_query(challenge=challenge)
        form = self.client.get(url).context['form']
        response = self.client.post(
            url, {k: v for k, v in form.initial.items() if v is not None})
        self.assertIn('error=access_denied', response['Location'])
        self.assertFalse(models.ConnectedApp.objects.exists())
        self.assertFalse(Grant.objects.exists())

    def test_an_app_cant_skip_the_consent_page(self):
        self.connect(self.registrar)
        _, challenge = pkce_pair()
        self.client.force_login(self.registrar)
        response = self.client.get(self.authorize_query(
            challenge=challenge, approval_prompt='auto'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Connect')

    def test_approving_again_replaces_what_was_approved_before(self):
        first = self.connect(self.registrar)
        second = self.connect(self.registrar, scope='read')
        self.assertEqual(models.ConnectedApp.objects.get(user=self.registrar).scope, 'read')
        self.assertEqual(self.refresh(first['refresh_token']).status_code, 400)
        self.assertEqual(self.api('get', '/api/user', first['access_token']).status_code, 401)
        self.assertEqual(self.refresh(second['refresh_token']).json()['scope'], 'read')

    def test_a_redirect_uri_with_a_code_of_its_own_still_works(self):
        uri = REDIRECT_URI + '?code=fixed'
        self.app.redirect_uris = f'{REDIRECT_URI} {uri}'
        self.app.save()
        code, verifier = self.approve(self.registrar, redirect_uri=uri)
        response = self.client.post('/o/token/', {
            'grant_type': 'authorization_code', 'code': code, 'redirect_uri': uri,
            'client_id': self.app.client_id, 'client_secret': SECRET,
            'code_verifier': verifier})
        self.assertEqual(response.status_code, 200, response.content)

    def test_pkce_is_required(self):
        self.client.force_login(self.registrar)
        response = self.client.get(self.authorize_query())
        self.assertEqual(response.status_code, 302)
        self.assertIn('error=invalid_request', response['Location'])

    def test_the_redirect_uri_must_match_exactly(self):
        _, challenge = pkce_pair()
        self.client.force_login(self.registrar)
        response = self.client.get(self.authorize_query(
            challenge=challenge, redirect_uri=REDIRECT_URI + '/extra'))
        self.assertEqual(response.status_code, 400)
        self.assertContains(response, 'can’t connect', status_code=400)

    def test_the_code_needs_its_verifier_and_the_secret_and_works_once(self):
        code, verifier = self.approve(self.registrar)
        self.assertEqual(self.exchange(code, 'not-the-verifier' * 4).status_code, 400)
        code, verifier = self.approve(self.registrar)
        self.assertEqual(self.exchange(code, verifier, secret='wrong').status_code, 401)
        self.assertEqual(self.exchange(code, verifier).status_code, 200)
        self.assertEqual(self.exchange(code, verifier).status_code, 400)

    def test_someone_without_a_group_or_with_a_password_to_change_cant_approve(self):
        nobody = make_user(None)
        _, challenge = pkce_pair()
        self.client.force_login(nobody)
        response = self.client.get(self.authorize_query(challenge=challenge))
        self.assertContains(response, 'no Camphoric permission group', status_code=403)

        models.UserAccount.objects.create(user=self.registrar, must_change_password=True)
        self.client.force_login(self.registrar)
        response = self.client.post(self.authorize_query(challenge=challenge), {'allow': 'x'})
        self.assertContains(response, 'Choose a new password', status_code=403)
        self.assertFalse(models.ConnectedApp.objects.exists())

    def test_switching_account_signs_out_and_keeps_the_request(self):
        _, challenge = pkce_pair()
        url = self.authorize_query(challenge=challenge)
        self.client.force_login(self.admin)
        response = self.client.post('/o/switch-account/', {'next': url})
        self.assertEqual(response['Location'], f'/o/login/?{urlencode({"next": url})}')
        self.assertEqual(self.client.get(url).status_code, 302)  # signed out

    def test_approving_is_recorded_in_the_audit_log(self):
        self.connect(self.registrar)
        entry = LogEntry.objects.get_for_model(models.ConnectedApp).get()
        self.assertEqual((entry.action, entry.actor), (LogEntry.Action.CREATE, self.registrar))


def publish_terms(organization, waiver='Use at your own risk.'):
    draft = contracts.start_draft(organization)
    contracts.replace_sections(draft, [
        {'kind': 'privacy_policy', 'title': 'Privacy Policy', 'body': 'We keep it safe.'},
        {'kind': 'custom', 'title': 'Liability Waiver', 'body': waiver},
    ])
    return contracts.publish(draft, None)


class TermsBeforeConsentTests(OAuthTestCase):
    '''Each organization's pending terms, in turn, before the consent page (DR-151).'''

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.camp = cls.made.organization  # "Camp Org"
        cls.another = models.Organization.objects.create(name='Another camp')
        publish_terms(cls.camp, waiver='**Bold** waiver <script>alert(1)</script>')
        publish_terms(cls.another)

    def start(self, user=None):
        _, challenge = pkce_pair()
        self.client.force_login(user or self.registrar)
        return self.authorize_query(challenge=challenge)

    def agree_to_shown(self, url, page, **headers):
        contract = page.context['contract']
        return self.client.post(url, {
            'terms': 'agree', 'organization': contract.organization_id,
            'contract_id': contract.pk, 'content_sha256': contract.content_sha256}, **headers)

    def test_each_organization_in_turn_by_name_then_the_consent_page(self):
        url = self.start()
        first = self.client.get(url)
        self.assertEqual(first.status_code, 200)
        self.assertTemplateUsed(first, 'camphoric/oauth/terms.html')
        self.assertEqual(first.context['contract'].organization, self.another)
        self.assertContains(first, 'Organization 1 of 2')
        self.assertContains(first, 'Lark admin tool')
        self.assertContains(first, f'/organizations/{self.another.pk}/privacy-policy')

        response = self.agree_to_shown(url, first)
        self.assertEqual(response['Location'], url)
        second = self.client.get(url)
        self.assertEqual(second.context['contract'].organization, self.camp)
        self.assertContains(second, 'Organization 2 of 2')
        # Its Markdown, rendered and sanitized.
        self.assertContains(second, '<strong>Bold</strong> waiver')
        self.assertNotContains(second, '<script>alert(1)')

        self.agree_to_shown(url, second)
        consent = self.client.get(url)
        self.assertTemplateUsed(consent, 'camphoric/oauth/authorize.html')
        self.assertNotIn(views_module.TERMS_AGREED, self.client.session)

    @freeze_time(NOW)
    @override_settings(CAMPHORIC_VERSION='9.9.9')
    def test_agreeing_records_what_the_admin_client_does(self):
        url = self.start()
        self.agree_to_shown(url, self.client.get(url), HTTP_USER_AGENT='Firefox 200',
                            REMOTE_ADDR='203.0.113.5')
        agreement = models.ContractAgreement.objects.get()
        self.assertEqual((agreement.organization, agreement.user), (self.another, self.registrar))
        self.assertEqual(agreement.contract, contracts.latest_contract(self.another.pk))
        self.assertEqual((agreement.agreed_at, agreement.username, agreement.ip_address,
                          agreement.user_agent, agreement.assent_text, agreement.app_version),
                         (NOW, 'registrar', '203.0.113.5', 'Firefox 200', 'I agree', '9.9.9'))
        self.assertEqual(agreement.content_sha256, agreement.contract.content_sha256)

    def test_no_code_while_terms_are_pending(self):
        url = self.start()
        response = self.client.post(url, {
            'client_id': self.app.client_id, 'redirect_uri': REDIRECT_URI,
            'response_type': 'code', 'state': 'xyz', 'scope': 'read write', 'allow': 'Authorize'})
        self.assertEqual(response['Location'], url)
        self.assertFalse(Grant.objects.exists())
        self.assertFalse(models.ConnectedApp.objects.exists())

    def test_declining_signs_out_and_tells_the_app(self):
        url = self.start()
        response = self.client.post(url, {'terms': 'decline'})
        location = urlparse(response['Location'])
        self.assertEqual(f'{location.scheme}://{location.netloc}{location.path}', REDIRECT_URI)
        query = parse_qs(location.query)
        self.assertEqual((query['error'], query['state']), (['access_denied'], ['xyz']))
        self.assertNotIn('_auth_user_id', self.client.session)
        self.assertFalse(models.ContractAgreement.objects.exists())
        self.assertFalse(Grant.objects.exists())

    def test_terms_changed_since_they_were_shown(self):
        url = self.start()
        page = self.client.get(url)
        publish_terms(self.another, waiver='Changed.')
        response = self.agree_to_shown(url, page)
        self.assertEqual(response.status_code, 409)
        self.assertContains(response, 'changed since you opened them', status_code=409)
        self.assertContains(response, 'Changed.', status_code=409)
        self.assertFalse(models.ContractAgreement.objects.exists())

    def test_an_invalid_request_isnt_asked_about(self):
        self.client.force_login(self.registrar)
        response = self.client.get(self.authorize_query(redirect_uri='https://evil.example.com/'))
        self.assertTemplateNotUsed(response, 'camphoric/oauth/terms.html')
        self.assertFalse(response.has_header('Location')
                         and 'evil.example.com' in response['Location'])

    def test_signing_in_leads_to_the_terms(self):
        url = self.authorize_query(challenge=pkce_pair()[1])
        login = f'/o/login/?{urlencode({"next": url})}'
        self.client.post(login, {'username': 'registrar', 'password': 'password', 'next': url})
        self.assertTemplateUsed(self.client.get(url), 'camphoric/oauth/terms.html')

    def test_an_app_connected_afterwards_isnt_refused_for_terms(self):
        url = self.start()
        for _ in range(2):
            self.agree_to_shown(url, self.client.get(url))
        self.client.logout()
        tokens = self.connect(self.registrar)
        event = self.made.event
        response = self.api('get', f'/api/events/{event.pk}/', tokens['access_token'])
        self.assertEqual(response.status_code, 200, response.content)


class ScopeAndRoleTests(OAuthTestCase):
    def test_a_read_token_reads_but_doesnt_write(self):
        token = self.connect(self.admin, scope='read')['access_token']
        self.assertEqual(self.api('get', '/api/organizations/', token).status_code, 200)
        response = self.api('post', '/api/organizations/', token, {'name': 'Another'})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['code'], oauth.INSUFFICIENT_SCOPE)

    def test_a_read_token_may_use_a_post_that_only_reads(self):
        report = models.Report.objects.create(
            event=self.made.event, title='Count', template='{{ campers | length }}',
            output='md', variables_source='server')
        token = self.connect(self.reporter, scope='read')['access_token']
        response = self.api('post', f'/api/reports/{report.id}/render', token, {})
        self.assertEqual(response.status_code, 200, response.data)

    def test_a_write_token_is_held_to_the_users_role(self):
        token = self.connect(self.reporter)['access_token']
        response = self.api('patch', f'/api/events/{self.made.event.id}/', token,
                            {'name': 'Renamed'})
        self.assertEqual(response.status_code, 403)
        token = self.connect(self.registrar)['access_token']
        self.assertEqual(self.api('post', '/api/organizations/', token,
                                  {'name': 'Another'}).status_code, 403)
        token = self.connect(self.admin)['access_token']
        self.assertEqual(self.api('post', '/api/organizations/', token,
                                  {'name': 'Another'}).status_code, 201)

    def test_an_app_never_manages_accounts(self):
        token = self.connect(self.admin)['access_token']
        refused = [
            ('get', '/api/users/', None),
            ('post', '/api/user/password', {'current_password': 'password',
                                            'new_password': 'a new long password'}),
            ('get', '/api/user/apps', None),
            ('get', '/api/applications/', None),
            ('post', f'/api/organizations/{self.made.event.organization_id}/contract/agree', {}),
        ]
        for method, path, data in refused:
            with self.subTest(path=path):
                response = self.api(method, path, token, data)
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.data['code'], oauth.APP_NOT_ALLOWED)

    def test_the_role_is_the_current_one(self):
        token = self.connect(self.admin)['access_token']
        roles.set_role(self.admin, roles.REPORTER)
        self.assertEqual(self.api('post', '/api/organizations/', token,
                                  {'name': 'Another'}).status_code, 403)

    def test_last_used_is_noted_to_the_minute(self):
        with freeze_time(NOW):
            token = self.connect(self.registrar)['access_token']
            self.api('get', '/api/organizations/', token)
        with freeze_time(NOW + timedelta(seconds=30)):
            self.api('get', '/api/organizations/', token)
        connection = models.ConnectedApp.objects.get(user=self.registrar)
        self.assertEqual(connection.last_used_at, NOW)
        with freeze_time(NOW + timedelta(minutes=2)):
            self.api('get', '/api/organizations/', token)
        connection.refresh_from_db()
        self.assertEqual(connection.last_used_at, NOW + timedelta(minutes=2))


class TokenLifetimeTests(OAuthTestCase):
    def test_an_access_token_works_for_an_hour(self):
        with freeze_time(NOW):
            token = self.connect(self.registrar)['access_token']
        with freeze_time(NOW + timedelta(minutes=59)):
            self.assertEqual(self.api('get', '/api/user', token).status_code, 200)
        with freeze_time(NOW + timedelta(hours=1)):
            self.assertEqual(self.api('get', '/api/user', token).status_code, 401)

    def test_a_refresh_token_is_replaced_each_time_its_used(self):
        tokens = self.connect(self.registrar)
        renewed = self.refresh(tokens['refresh_token'])
        self.assertEqual(renewed.status_code, 200, renewed.content)
        renewed = renewed.json()
        self.assertNotEqual(renewed['refresh_token'], tokens['refresh_token'])
        self.assertEqual(self.api('get', '/api/user', renewed['access_token']).status_code, 200)
        self.assertEqual(self.api('get', '/api/user', tokens['access_token']).status_code, 401)

    def test_reusing_a_replaced_refresh_token_ends_the_approval(self):
        tokens = self.connect(self.registrar)
        renewed = self.refresh(tokens['refresh_token']).json()
        replay = self.refresh(tokens['refresh_token'])
        self.assertEqual(replay.status_code, 400)
        self.assertEqual(replay.json()['error'], 'invalid_grant')
        self.assertEqual(self.api('get', '/api/user', renewed['access_token']).status_code, 401)
        self.assertEqual(self.refresh(renewed['refresh_token']).status_code, 400)

    @override_settings(CAMPHORIC_OAUTH_REFRESH_TOKEN_TTL=90 * 24 * 60 * 60)
    def test_a_refresh_token_left_unused_stops_working(self):
        with freeze_time(NOW):
            tokens = self.connect(self.registrar)
        with freeze_time(NOW + timedelta(days=89)):
            renewed = self.refresh(tokens['refresh_token'])
            self.assertEqual(renewed.status_code, 200)
        with freeze_time(NOW + timedelta(days=89 + 91)):
            self.assertEqual(self.refresh(renewed.json()['refresh_token']).status_code, 400)


class RevocationTests(OAuthTestCase):
    def assert_ended(self, tokens, user):
        self.assertEqual(self.api('get', '/api/user', tokens['access_token']).status_code, 401)
        self.assertEqual(self.refresh(tokens['refresh_token']).status_code, 400)
        self.assertFalse(models.ConnectedApp.objects.filter(user=user).exists())

    def test_disconnecting_an_app_ends_its_access(self):
        tokens = self.connect(self.registrar)
        self.client.force_login(self.registrar)
        listed = self.client.get('/api/user/apps')
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data[0]['application'],
                         {'id': self.app.id, 'name': 'Lark admin tool'})
        self.assertEqual(listed.data[0]['scopes'], ['read', 'write'])
        self.assertEqual(self.client.delete(f'/api/user/apps/{self.app.id}').status_code, 204)
        self.assertEqual(self.client.delete(f'/api/user/apps/{self.app.id}').status_code, 404)
        self.client.logout()
        self.assert_ended(tokens, self.registrar)
        entry = LogEntry.objects.get_for_model(models.ConnectedApp).latest('timestamp')
        self.assertEqual((entry.action, entry.actor), (LogEntry.Action.DELETE, self.registrar))

    def test_disconnecting_leaves_other_users_and_apps_alone(self):
        other_app = Application.objects.create(
            name='Other', client_type=Application.CLIENT_CONFIDENTIAL,
            authorization_grant_type=Application.GRANT_AUTHORIZATION_CODE,
            redirect_uris=REDIRECT_URI)
        mine = self.connect(self.registrar)
        theirs = self.connect(self.reporter)
        oauth.connect(self.registrar, other_app, 'read', code='')
        oauth.revoke(self.registrar, self.app)
        self.assertEqual(self.api('get', '/api/user', mine['access_token']).status_code, 401)
        self.assertEqual(list(models.ConnectedApp.objects.values_list(
            'user__username', 'application__name')),
            [('reporter', 'Lark admin tool'), ('registrar', 'Other')])
        self.assertEqual(self.api('get', '/api/user', theirs['access_token']).status_code, 200)

    def test_deactivating_a_user_ends_their_apps_access(self):
        tokens = self.connect(self.registrar)
        self.client.force_login(self.admin)
        response = self.client.patch(f'/api/users/{self.registrar.id}/', {'is_active': False},
                                     format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.client.logout()
        self.assert_ended(tokens, self.registrar)
        self.assertFalse(AccessToken.objects.filter(user=self.registrar).exists())

    def test_changing_your_password_ends_your_apps_access(self):
        tokens = self.connect(self.registrar)
        self.client.force_login(self.registrar)
        response = self.client.post('/api/user/password', {
            'current_password': 'password', 'new_password': 'a brand new passphrase'},
            format='json')
        self.assertEqual(response.status_code, 204)
        self.client.logout()
        self.assert_ended(tokens, self.registrar)

    def test_a_superuser_setting_a_password_ends_the_apps_access(self):
        superuser = make_user(roles.ADMIN, 'root', django_access=roles.SUPERUSER)
        tokens = self.connect(self.registrar)
        self.client.force_login(superuser)
        response = self.client.post(f'/api/users/{self.registrar.id}/set-password/',
                                    {'password': 'a brand new passphrase'}, format='json')
        self.assertEqual(response.status_code, 204)
        self.client.logout()
        self.assert_ended(tokens, self.registrar)

    def test_a_password_changed_in_the_django_admin_ends_the_apps_access(self):
        superuser = make_user(roles.ADMIN, 'root', django_access=roles.SUPERUSER)
        tokens = self.connect(self.registrar)
        api_token = Token.objects.create(user=self.registrar)
        self.client.force_login(superuser)
        response = self.client.post(
            f'/django-admin/auth/user/{self.registrar.id}/password/',
            {'password1': 'a brand new passphrase', 'password2': 'a brand new passphrase',
             'usable_password': 'true'})
        self.assertEqual(response.status_code, 302)
        self.client.logout()
        self.assert_ended(tokens, self.registrar)
        self.assertFalse(Token.objects.filter(key=api_token.key).exists())

    def test_an_upgraded_password_hash_changes_nothing(self):
        tokens = self.connect(self.registrar)
        # What Django does when it rehashes a password at sign-in.
        self.registrar.set_password('password')
        self.registrar._password = None
        self.registrar.save(update_fields=['password'])
        self.assertTrue(models.ConnectedApp.objects.filter(user=self.registrar).exists())
        self.assertEqual(self.refresh(tokens['refresh_token']).status_code, 200)

    def test_an_app_giving_its_token_back_disconnects_it(self):
        tokens = self.connect(self.registrar)
        response = self.client.post('/o/revoke_token/', {
            'token': tokens['refresh_token'], 'client_id': self.app.client_id,
            'client_secret': SECRET})
        self.assertEqual(response.status_code, 200)
        self.assert_ended(tokens, self.registrar)

    def test_reusing_a_replaced_refresh_token_disconnects_the_app(self):
        tokens = self.connect(self.registrar)
        self.assertEqual(self.refresh(tokens['refresh_token']).status_code, 200)
        self.assertEqual(self.refresh(tokens['refresh_token']).status_code, 400)
        self.assertFalse(models.ConnectedApp.objects.filter(user=self.registrar).exists())

    def test_removing_the_app_ends_every_users_access(self):
        mine = self.connect(self.registrar)
        theirs = self.connect(self.reporter)
        self.client.force_login(self.admin)
        self.assertEqual(self.client.delete(f'/api/applications/{self.app.id}/').status_code,
                         204)
        self.client.logout()
        for tokens in (mine, theirs):
            self.assertEqual(self.api('get', '/api/user', tokens['access_token']).status_code,
                             401)
        self.assertFalse(models.ConnectedApp.objects.exists())

    def test_an_admin_sees_and_disconnects_a_users_apps(self):
        tokens = self.connect(self.registrar)
        self.client.force_login(self.admin)
        listed = self.client.get(f'/api/users/{self.registrar.id}/apps/')
        self.assertEqual([app['application']['name'] for app in listed.data],
                         ['Lark admin tool'])
        response = self.client.delete(f'/api/users/{self.registrar.id}/apps/{self.app.id}/')
        self.assertEqual(response.status_code, 204)
        self.client.logout()
        self.assert_ended(tokens, self.registrar)

    def test_only_a_superuser_disconnects_a_django_access_users_apps(self):
        staff = make_user(roles.REGISTRAR, 'staff', django_access=roles.STAFF)
        self.connect(staff)
        self.client.force_login(self.admin)
        self.assertEqual(len(self.client.get(f'/api/users/{staff.id}/apps/').data), 1)
        self.assertEqual(
            self.client.delete(f'/api/users/{staff.id}/apps/{self.app.id}/').status_code, 404)
        superuser = make_user(roles.ADMIN, 'root', django_access=roles.SUPERUSER)
        self.client.force_login(superuser)
        self.assertEqual(
            self.client.delete(f'/api/users/{staff.id}/apps/{self.app.id}/').status_code, 204)

    def test_others_cant_see_a_users_apps(self):
        self.client.force_login(self.registrar)
        self.assertEqual(self.client.get(f'/api/users/{self.reporter.id}/apps/').status_code,
                         404)


class ThrottleTests(OAuthTestCase):
    def test_an_invalid_access_token_is_refused_and_counted(self):
        response = self.api('get', '/api/user', 'not-a-token')
        self.assertEqual(response.status_code, 401)
        self.assertTrue(response['WWW-Authenticate'].startswith('Bearer'))
        for _ in range(29):
            self.assertEqual(self.api('get', '/api/user', 'not-a-token').status_code, 401)
        self.assertEqual(self.api('get', '/api/user', 'not-a-token').status_code, 429)

    def test_a_valid_token_isnt_refused_for_others_failures(self):
        tokens = self.connect(self.registrar)
        for _ in range(31):
            self.api('get', '/api/user', 'not-a-token')
        self.assertEqual(self.api('get', '/api/user', 'not-a-token').status_code, 429)
        self.assertEqual(self.api('get', '/api/user', tokens['access_token']).status_code, 200)

    def test_the_token_endpoint_is_throttled_per_address(self):
        for _ in range(OAuthTokenThrottle().num_requests):
            self.refresh('not-a-refresh-token')
        response = self.refresh('not-a-refresh-token')
        self.assertEqual(response.status_code, 429)
        self.assertIn('Retry-After', response)


class OtherGrantTests(OAuthTestCase):
    def test_a_token_no_person_approved_is_refused(self):
        machine = Application.objects.create(
            name='Machine', client_type=Application.CLIENT_CONFIDENTIAL,
            authorization_grant_type=Application.GRANT_CLIENT_CREDENTIALS)
        AccessToken.objects.create(
            user=None, application=machine, token='machine-token', scope='read',
            expires=datetime.now(timezone.utc) + timedelta(hours=1))
        response = self.api('get', '/api/organizations/', 'machine-token')
        self.assertEqual(response.status_code, 401)

    def test_the_django_admin_only_shows_apps_and_tokens(self):
        superuser = make_user(roles.ADMIN, 'root', django_access=roles.SUPERUSER)
        self.client.force_login(superuser)
        self.assertEqual(
            self.client.get('/django-admin/oauth2_provider/application/').status_code, 200)
        self.assertEqual(
            self.client.get('/django-admin/oauth2_provider/application/add/').status_code, 403)
        response = self.client.post(
            f'/django-admin/oauth2_provider/application/{self.app.pk}/delete/', {'post': 'yes'})
        self.assertEqual(response.status_code, 403)


class SignalTests(APITestCase):
    def test_access_ends_in_processes_that_load_no_urls(self):
        # manage.py changepassword, or a shell, never loads the URLconf.
        script = (
            'import django, sys; django.setup()\n'
            'from django.contrib.auth import get_user_model\n'
            'from django.db.models.signals import post_save\n'
            'import weakref\n'
            'refs = [r[1] for r in post_save.receivers]\n'
            'names = {getattr(r() if isinstance(r, weakref.ref) else r, "__name__", "")'
            ' for r in refs}\n'
            'sys.exit(0 if {"end_old_credentials", "revoke_when_deactivated"} <= names else 1)\n'
        )
        result = subprocess.run(
            [sys.executable, '-c', script], env={**os.environ},
            capture_output=True, text=True, timeout=120)
        self.assertEqual(result.returncode, 0, result.stderr)


class OtherAuthenticationTests(OAuthTestCase):
    def test_sessions_and_api_tokens_still_work(self):
        self.client.force_login(self.registrar)
        self.assertEqual(self.client.get('/api/organizations/').status_code, 200)
        self.client.logout()
        key = Token.objects.create(user=self.registrar).key
        response = self.client.get('/api/organizations/', HTTP_AUTHORIZATION=f'Token {key}')
        self.assertEqual(response.status_code, 200)


class ApplicationApiTests(OAuthTestCase):
    def test_only_admins_reach_it(self):
        for user in (self.registrar, self.reporter):
            self.client.force_login(user)
            self.assertEqual(self.client.get('/api/applications/').status_code, 404)

    def test_registering_an_app_shows_its_secret_once(self):
        self.client.force_login(self.admin)
        response = self.client.post('/api/applications/', {
            'name': 'Sync', 'redirect_uris': ['https://sync.example.com/cb']}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        secret = response.data['client_secret']
        self.assertEqual(response.data['redirect_uris'], ['https://sync.example.com/cb'])
        app = Application.objects.get(pk=response.data['id'])
        self.assertNotEqual(app.client_secret, secret)  # stored hashed
        self.assertEqual((app.client_type, app.authorization_grant_type),
                         (Application.CLIENT_CONFIDENTIAL, Application.GRANT_AUTHORIZATION_CODE))
        listed = self.client.get('/api/applications/').data
        self.assertNotIn('client_secret', listed[0])
        self.assertEqual({a['name']: a['connected_users'] for a in listed},
                         {'Lark admin tool': 0, 'Sync': 0})
        entry = LogEntry.objects.get_for_object(app).get()
        self.assertNotIn('client_secret', entry.changes)
        self.assertEqual(entry.actor, self.admin)

    def test_redirect_uris_are_checked(self):
        self.client.force_login(self.admin)
        for uris in ([], ['not a uri'], ['https://a.example.com/cb#fragment']):
            with self.subTest(uris=uris):
                response = self.client.post('/api/applications/', {
                    'name': 'Sync', 'redirect_uris': uris}, format='json')
                self.assertEqual(response.status_code, 400)
                self.assertIn('redirect_uris', response.data)

    def test_http_redirects_only_where_allowed(self):
        self.client.force_login(self.admin)
        settings = {**oauth_settings(), 'ALLOWED_REDIRECT_URI_SCHEMES': ['https']}
        with override_settings(OAUTH2_PROVIDER=settings):
            response = self.client.post('/api/applications/', {
                'name': 'Sync', 'redirect_uris': ['http://sync.example.com/cb']}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_a_new_secret_replaces_the_old(self):
        code, verifier = self.approve(self.registrar)
        self.client.force_login(self.admin)
        new = self.client.post(f'/api/applications/{self.app.id}/new-secret/').data
        entry = LogEntry.objects.get_for_object(self.app).get(action=LogEntry.Action.UPDATE)
        self.assertEqual((entry.actor, entry.changes),
                         (self.admin, {'client_secret': ['(hidden)', '(replaced)']}))
        self.client.logout()
        self.assertEqual(self.exchange(code, verifier).status_code, 401)
        code, verifier = self.approve(self.registrar)
        self.assertEqual(
            self.exchange(code, verifier, secret=new['client_secret']).status_code, 200)

    def test_renaming_and_who_connected(self):
        self.connect(self.registrar)
        self.client.force_login(self.admin)
        response = self.client.patch(f'/api/applications/{self.app.id}/', {'name': 'Admin tool'},
                                     format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['connected_users'], 1)
        connections = self.client.get(f'/api/applications/{self.app.id}/connections/').data
        self.assertEqual([c['user']['username'] for c in connections], ['registrar'])


def oauth_settings():
    from django.conf import settings
    return settings.OAUTH2_PROVIDER


class CleanUpTests(OAuthTestCase):
    def test_a_connection_left_with_nothing_that_works_is_removed(self):
        with freeze_time(NOW):
            self.connect(self.registrar)
        later = NOW + timedelta(days=91)
        with freeze_time(later):
            # Approved, with its code not yet exchanged: kept.
            oauth.connect(self.admin, self.app, 'read', code='abc')
            Grant.objects.create(
                user=self.admin, application=self.app, code='abc', redirect_uri=REDIRECT_URI,
                expires=later + timedelta(minutes=1), code_challenge='c',
                code_challenge_method='S256')
            # The registrar's refresh token went unused for its 90 days.
            self.assertEqual(oauth.clean_up(), 1)
        self.assertEqual(list(models.ConnectedApp.objects.values_list('user__username', flat=True)),
                         ['admin'])
        self.assertFalse(RefreshToken.objects.filter(user=self.registrar, revoked=None).exists()
                         and AccessToken.objects.filter(user=self.registrar).exists())

    def test_a_connection_that_still_works_is_kept(self):
        with freeze_time(NOW):
            tokens = self.connect(self.registrar)
        with freeze_time(NOW + timedelta(days=80)):
            self.assertEqual(self.refresh(tokens['refresh_token']).status_code, 200)
        with freeze_time(NOW + timedelta(days=91)):
            self.assertEqual(oauth.clean_up(), 0)
        self.assertTrue(models.ConnectedApp.objects.filter(user=self.registrar).exists())

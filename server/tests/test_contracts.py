'''
Each organization's contract, and the gate it puts in front of the
organization (SPEC §5, §6; §15 DR-145): until someone has agreed to its latest
version, nothing that belongs to the organization is reachable, by session or
token, and lists leave its records out.
'''

import datetime
from decimal import Decimal
import re
from unittest import mock

from django.conf import settings
from django.contrib.auth.models import AnonymousUser, User
from django.contrib.contenttypes.models import ContentType
from django.test import Client, TestCase, override_settings
from django.urls.resolvers import RegexPattern
from django.utils import timezone
from freezegun import freeze_time
from auditlog.models import LogEntry
from rest_framework import serializers as drf_serializers
from rest_framework.test import APITestCase

from camphoric import (
    accounts, authentication, contracts, deletes, live_stream, models, roles, serializers)
from camphoric import urls as api_urls
from tests.factories import create_template_event, make_user

GATED = 'contract_agreement_required'


def publish_contract(organization, sections=None, by=None):
    '''Publish the organization's next version: by default a privacy policy and a waiver.'''
    draft = contracts.start_draft(organization)
    contracts.replace_sections(draft, sections or [
        {'kind': 'privacy_policy', 'title': 'Privacy Policy', 'body': 'We keep your data safe.'},
        {'kind': 'custom', 'title': 'Liability Waiver', 'body': 'Use at your own risk.'},
    ])
    return contracts.publish(draft, by)


def agree(client, organization, contract=None, assent_text='I agree', **headers):
    contract = contract or contracts.latest_contract(organization.pk)
    return client.post(
        f'/api/organizations/{organization.pk}/contract/agree',
        {'contract_id': contract.pk, 'content_sha256': contract.content_sha256,
         'assent_text': assent_text}, format='json', **headers)


def is_gated(response, organization):
    if response.status_code != 403:
        return False
    data = response.json()
    return (response.status_code == 403 and isinstance(data, dict)
            and data.get('code') == GATED and data.get('organization') == organization.pk)


class PendingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.organization = models.Organization.objects.create(name='Camp')
        cls.other = models.Organization.objects.create(name='Other camp')
        cls.user = make_user(roles.REPORTER, 'rita')

    def pending(self):
        user = User.objects.get(pk=self.user.pk)
        return contracts.pending_organization_ids(user)

    def test_no_published_version_no_gate(self):
        self.assertEqual(self.pending(), [])
        contracts.start_draft(self.organization)
        self.assertEqual(self.pending(), [])

    def test_the_latest_version_until_agreed(self):
        first = publish_contract(self.organization)
        self.assertEqual(self.pending(), [self.organization.pk])
        models.ContractAgreement.objects.create(
            organization=self.organization, user=self.user, contract=first,
            agreed_at=timezone.now(), username='rita', content_sha256=first.content_sha256,
            assent_text='I agree')
        self.assertEqual(self.pending(), [])
        # Every new version needs agreeing to again, even for a typo.
        publish_contract(self.organization)
        self.assertEqual(self.pending(), [self.organization.pk])

    def test_each_organization_apart(self):
        publish_contract(self.organization)
        publish_contract(self.other)
        self.assertEqual(self.pending(), sorted([self.organization.pk, self.other.pk]))

    def test_nobody_signed_in(self):
        publish_contract(self.organization)
        self.assertEqual(contracts.pending_organization_ids(AnonymousUser()), [])


class DraftingTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.organization = models.Organization.objects.create(name='Camp')
        cls.admin = make_user(roles.ADMIN, 'ada')

    def setUp(self):
        self.client.force_login(self.admin)

    def publish(self):
        '''Publish a version, which the Admin then agrees to, to go on managing them.'''
        contract = publish_contract(self.organization)
        agree(self.client, self.organization)
        return contract

    def start(self):
        return self.client.post('/api/contracts/', {'organization': self.organization.pk},
                                format='json')

    def test_the_first_draft_is_an_empty_privacy_policy(self):
        response = self.start()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['sections'], [
            {'kind': 'privacy_policy', 'title': 'Privacy Policy', 'body': ''}])
        self.assertIsNone(response.data['number'])
        self.assertIsNone(response.data['published_at'])

    def test_a_later_draft_copies_the_latest_version(self):
        self.publish()
        sections = self.start().data['sections']
        self.assertEqual([s['title'] for s in sections], ['Privacy Policy', 'Liability Waiver'])

    def test_one_draft_at_a_time(self):
        self.start()
        self.assertEqual(self.start().status_code, 409)

    def test_sections_are_changed_and_reordered_as_a_whole(self):
        draft = self.start().data
        sections = [
            {'kind': 'custom', 'title': 'Liability Waiver', 'body': 'Risky.'},
            {'kind': 'privacy_policy', 'title': 'Your data', 'body': 'Kept safe.'},
        ]
        response = self.client.patch(f'/api/contracts/{draft["id"]}/', {'sections': sections},
                                     format='json', HTTP_IF_MATCH=f'"{draft["version"]}"')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['sections'], sections)
        self.assertEqual(response.data['version'], draft['version'] + 1)

    def test_a_title_is_kept_as_typed(self):
        draft = self.start().data
        sections = [{'kind': 'privacy_policy', 'title': 'Your data ', 'body': 'Kept safe. '}]
        response = self.client.patch(
            f'/api/contracts/{draft["id"]}/', {'sections': sections}, format='json')
        self.assertEqual(response.data['sections'], sections)

    def test_the_privacy_policy_cant_be_removed_or_doubled(self):
        draft = self.start().data
        for sections in (
            [{'kind': 'custom', 'title': 'Waiver', 'body': 'Risky.'}],
            [{'kind': 'privacy_policy', 'title': 'A', 'body': 'a'},
             {'kind': 'privacy_policy', 'title': 'B', 'body': 'b'}],
            [],
        ):
            response = self.client.patch(
                f'/api/contracts/{draft["id"]}/', {'sections': sections}, format='json')
            self.assertEqual(response.status_code, 400, sections)

    def test_publishing_refuses_an_empty_section(self):
        draft = self.start().data
        response = self.client.post(f'/api/contracts/{draft["id"]}/publish/')
        self.assertEqual(response.status_code, 400)
        self.assertIsNone(models.Contract.objects.get(pk=draft['id']).published_at)

    @freeze_time('2026-11-04 12:00:00')
    def test_publishing_numbers_and_seals_the_version(self):
        self.publish()
        draft = self.start().data
        response = self.client.post(f'/api/contracts/{draft["id"]}/publish/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['number'], 2)
        self.assertEqual(response.data['published_by'], self.admin.pk)
        self.assertEqual(response.data['published_at'], '2026-11-04T12:00:00Z')
        contract = models.Contract.objects.get(pk=draft['id'])
        self.assertEqual(contract.content_sha256, contracts.content_sha256(
            [{'title': s['title'], 'body': s['body']} for s in draft['sections']]))
        # (Agreeing to it first, to go on managing them.)
        agree(self.client, self.organization)
        self.assertEqual(self.client.post(f'/api/contracts/{draft["id"]}/publish/').status_code,
                         409)

    def test_publishing_only_the_version_read(self):
        draft = self.start().data
        sections = [{'kind': 'privacy_policy', 'title': 'Privacy Policy', 'body': 'Changed.'}]
        self.client.patch(f'/api/contracts/{draft["id"]}/', {'sections': sections},
                          format='json')
        response = self.client.post(f'/api/contracts/{draft["id"]}/publish/',
                                    HTTP_IF_MATCH=f'"{draft["version"]}"')
        self.assertEqual(response.status_code, 412)
        self.assertIsNone(models.Contract.objects.get(pk=draft['id']).published_at)
        response = self.client.post(f'/api/contracts/{draft["id"]}/publish/',
                                    HTTP_IF_MATCH=f'"{draft["version"] + 1}"')
        self.assertEqual(response.status_code, 200)

    def test_an_organization_with_terms_nobody_agreed_to_can_be_deleted(self):
        drafting = models.Organization.objects.create(name='Drafting')
        contracts.start_draft(drafting)
        self.assertEqual(
            self.client.delete(f'/api/organizations/{drafting.pk}/').status_code, 204)
        # Published, but nobody agreed (an Admin would have to agree to delete it here).
        published = models.Organization.objects.create(name='Published')
        publish_contract(published)
        contracts.start_draft(published)
        deletes.plan(published).carry_out()
        self.assertFalse(models.Contract.objects.filter(
            organization_id__in=[drafting.pk, published.pk]).exists())

    def test_a_published_version_cant_change_or_go(self):
        contract = self.publish()
        sections = [{'kind': 'privacy_policy', 'title': 'Changed', 'body': 'Changed'}]
        response = self.client.patch(f'/api/contracts/{contract.pk}/', {'sections': sections},
                                     format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.client.delete(f'/api/contracts/{contract.pk}/').status_code, 409)
        self.assertEqual(contract.sections.first().title, 'Privacy Policy')

    def test_a_draft_can_be_deleted(self):
        draft = self.start().data
        self.assertEqual(self.client.delete(f'/api/contracts/{draft["id"]}/').status_code, 204)
        self.assertFalse(models.Contract.objects.filter(pk=draft['id']).exists())

    def test_a_version_stays_with_its_organization(self):
        other = models.Organization.objects.create(name='Other')
        draft = self.start().data
        response = self.client.patch(f'/api/contracts/{draft["id"]}/',
                                     {'organization': other.pk}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_only_admins_manage_contracts(self):
        contract = self.publish()
        for role in (roles.REGISTRAR, roles.REPORTER):
            self.client.force_login(make_user(role, f'{role}-person'))
            agree(self.client, self.organization)
            self.assertEqual(self.client.get('/api/contracts/').status_code, 403)
            self.assertEqual(
                self.client.get(f'/api/contracts/{contract.pk}/agreements/').status_code, 403)
            self.assertEqual(self.start().status_code, 403)

    def test_who_has_agreed(self):
        contract = self.publish()
        response = self.client.get(f'/api/contracts/{contract.pk}/agreements/')
        self.assertEqual(response.status_code, 200)
        [row] = response.data
        self.assertEqual((row['username'], row['contract_number']), ('ada', 1))


class AgreeingTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.organization = models.Organization.objects.create(name='Camp')
        cls.contract = publish_contract(cls.organization)
        cls.user = make_user(roles.REPORTER, 'rita', first_name='Rita', last_name='Reads',
                             email='rita@example.com')

    def setUp(self):
        self.client.force_login(self.user)

    def test_the_user_is_told_what_to_agree_to(self):
        response = self.client.get('/api/user')
        self.assertEqual(response.data['pending_contract_organizations'], [self.organization.pk])
        response = self.client.get(f'/api/organizations/{self.organization.pk}/contract')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['agreed'])
        contract = response.data['contract']
        self.assertEqual(contract['id'], self.contract.pk)
        self.assertEqual(contract['number'], 1)
        self.assertEqual(contract['organization_name'], 'Camp')
        self.assertEqual(contract['content_sha256'], self.contract.content_sha256)
        self.assertEqual([s['title'] for s in contract['sections']],
                         ['Privacy Policy', 'Liability Waiver'])

    def test_signing_in_says_so_too(self):
        self.client.logout()
        response = self.client.post('/api/login', {'username': 'rita', 'password': 'password'},
                                    format='json')
        self.assertEqual(response.data['pending_contract_organizations'], [self.organization.pk])

    @freeze_time('2026-11-04 12:00:00')
    @override_settings(CAMPHORIC_VERSION='9.9.9')
    def test_agreeing_records_what_shows_they_did(self):
        response = agree(self.client, self.organization, assent_text='I agree',
                         HTTP_USER_AGENT='Firefox 200', REMOTE_ADDR='203.0.113.5')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['pending_contract_organizations'], [])
        agreement = models.ContractAgreement.objects.get()
        self.assertEqual(agreement.organization, self.organization)
        self.assertEqual(agreement.user, self.user)
        self.assertEqual(agreement.contract, self.contract)
        self.assertEqual(agreement.agreed_at,
                         datetime.datetime(2026, 11, 4, 12, tzinfo=datetime.UTC))
        self.assertEqual((agreement.username, agreement.email, agreement.full_name),
                         ('rita', 'rita@example.com', 'Rita Reads'))
        self.assertEqual(agreement.ip_address, '203.0.113.5')
        self.assertEqual(agreement.user_agent, 'Firefox 200')
        self.assertEqual(agreement.content_sha256, self.contract.content_sha256)
        self.assertEqual(agreement.assent_text, 'I agree')
        self.assertEqual(agreement.app_version, '9.9.9')
        self.assertTrue(self.client.get(
            f'/api/organizations/{self.organization.pk}/contract').data['agreed'])

    def test_the_time_is_the_servers(self):
        self.client.post(
            f'/api/organizations/{self.organization.pk}/contract/agree',
            {'contract_id': self.contract.pk, 'content_sha256': self.contract.content_sha256,
             'assent_text': 'I agree', 'agreed_at': '2000-01-01T00:00:00Z'}, format='json')
        self.assertGreater(models.ContractAgreement.objects.get().agreed_at.year, 2000)

    @override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, 'NUM_PROXIES': 1})
    def test_behind_a_proxy_the_clients_address(self):
        agree(self.client, self.organization, REMOTE_ADDR='10.0.0.1',
              HTTP_X_FORWARDED_FOR='198.51.100.7')
        self.assertEqual(models.ContractAgreement.objects.get().ip_address, '198.51.100.7')

    def test_agreeing_again_does_no_harm(self):
        agree(self.client, self.organization)
        self.assertEqual(agree(self.client, self.organization).status_code, 200)
        self.assertEqual(models.ContractAgreement.objects.count(), 1)

    def test_only_what_they_were_shown(self):
        response = self.client.post(
            f'/api/organizations/{self.organization.pk}/contract/agree',
            {'contract_id': self.contract.pk, 'content_sha256': '0' * 64,
             'assent_text': 'I agree'}, format='json')
        self.assertEqual(response.status_code, 409)
        newer = publish_contract(self.organization)
        response = agree(self.client, self.organization, contract=self.contract)
        self.assertEqual(response.status_code, 409)
        self.assertFalse(models.ContractAgreement.objects.exists())
        self.assertEqual(agree(self.client, self.organization, contract=newer).status_code, 200)

    def test_a_body_that_isnt_an_object(self):
        response = self.client.post(f'/api/organizations/{self.organization.pk}/contract/agree',
                                    [1], format='json')
        self.assertEqual(response.status_code, 400)

    def test_agreeing_clears_what_the_request_knew_was_pending(self):
        from django.utils.functional import SimpleLazyObject
        user = User.objects.get(pk=self.user.pk)
        lazy = SimpleLazyObject(lambda: user)
        self.assertEqual(contracts.pending_organization_ids(lazy), [self.organization.pk])
        contracts.forget_pending(lazy)
        self.assertFalse(hasattr(user, '_camphoric_pending_contracts'))

    def test_the_wording_they_agreed_with_is_required(self):
        response = agree(self.client, self.organization, assent_text='  ')
        self.assertEqual(response.status_code, 400)

    def test_nothing_to_agree_to(self):
        other = models.Organization.objects.create(name='Other')
        self.assertEqual(
            self.client.get(f'/api/organizations/{other.pk}/contract').status_code, 404)
        response = self.client.post(
            f'/api/organizations/{other.pk}/contract/agree',
            {'contract_id': self.contract.pk, 'content_sha256': self.contract.content_sha256,
             'assent_text': 'I agree'}, format='json')
        self.assertEqual(response.status_code, 409)

    def test_signed_in_with_a_role_only(self):
        self.client.logout()
        path = f'/api/organizations/{self.organization.pk}/contract'
        self.assertIn(self.client.get(path).status_code, (401, 403))
        self.client.force_login(make_user(None, 'nobody'))
        self.assertEqual(self.client.get(path).status_code, 403)
        self.assertEqual(agree(self.client, self.organization).status_code, 403)

    def test_they_can_reread_what_they_agreed_to(self):
        agree(self.client, self.organization)
        publish_contract(self.organization)
        response = self.client.get('/api/user/agreements')
        self.assertEqual(response.status_code, 200)
        [row] = response.data
        self.assertEqual(row['contract']['number'], 1)
        self.assertEqual(row['contract']['sections'][1]['title'], 'Liability Waiver')

    def test_deleting_the_user_keeps_their_agreement(self):
        agree(self.client, self.organization)
        self.user.delete()
        agreement = models.ContractAgreement.objects.get()
        self.assertIsNone(agreement.user)
        self.assertEqual(agreement.username, 'rita')

    def test_agreements_cant_be_changed_through_the_api(self):
        agree(self.client, self.organization)
        self.client.force_login(make_user(roles.ADMIN, 'ada'))
        agree(self.client, self.organization)
        agreement = models.ContractAgreement.objects.first()
        for method in ('put', 'patch', 'delete'):
            response = getattr(self.client, method)(
                f'/api/contracts/{self.contract.pk}/agreements/', {}, format='json')
            self.assertEqual(response.status_code, 405)
        self.assertTrue(models.ContractAgreement.objects.filter(pk=agreement.pk).exists())

    def test_an_organization_with_agreements_cant_be_deleted(self):
        agree(self.client, self.organization)
        self.client.force_login(make_user(roles.ADMIN, 'ada'))
        agree(self.client, self.organization)
        response = self.client.delete(f'/api/organizations/{self.organization.pk}/')
        self.assertEqual(response.status_code, 409)
        self.assertIn('People have agreed to its terms.', response.data['detail'])


class PrivacyPolicyTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()
        cls.organization = cls.made.organization

    def test_anyone_can_read_it(self):
        contract = publish_contract(self.organization)
        response = self.client.get(f'/api/organizations/{self.organization.pk}/privacy-policy')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {
            'organization': self.organization.pk,
            'organization_name': 'Camp Org',
            'title': 'Privacy Policy',
            'body': 'We keep your data safe.',
            'number': 1,
            'published_at': contract.published_at,
        })

    def test_only_the_privacy_policy(self):
        publish_contract(self.organization)
        response = self.client.get(f'/api/organizations/{self.organization.pk}/privacy-policy')
        self.assertNotIn('Use at your own risk', str(response.data))

    def test_none_until_published(self):
        contracts.start_draft(self.organization)
        response = self.client.get(f'/api/organizations/{self.organization.pk}/privacy-policy')
        self.assertEqual(response.status_code, 404)

    def test_the_registration_page_links_to_it(self):
        path = f'/api/events/{self.made.event.pk}/register'
        self.assertIsNone(self.client.get(path).data['privacyPolicy'])
        publish_contract(self.organization)
        self.assertEqual(self.client.get(path).data['privacyPolicy'],
                         {'organization': self.organization.pk, 'title': 'Privacy Policy'})

    def test_registrants_never_meet_the_gate(self):
        publish_contract(self.organization)
        response = self.client.get(f'/api/events/{self.made.event.pk}/register')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get('/api/eventlist').status_code, 200)


# Not in any organization: users, and apps using OAuth with who approved them.
SITE_WIDE_VIEWS = {
    'UserViewSet', 'ApplicationViewSet', 'MyConnectedAppsView', 'MyConnectedAppView'}


def _fill_route(pattern, values):
    '''A route's path with its parameters filled in from `values`, or None if one is unknown.'''
    route = str(pattern.pattern)
    names = list(pattern.pattern.regex.groupindex)
    if any(name not in values for name in names):
        return None
    if isinstance(pattern.pattern, RegexPattern):  # a router's
        path = route.lstrip('^').rstrip('$')
        for name in names:
            path = re.sub(rf'\(\?P<{name}>[^)]*\)', str(values[name]), path)
        path = path.replace('\\.', '.')
    else:
        path = re.sub(r'<(?:\w+:)?(\w+)>', lambda match: str(values[match.group(1)]), route)
    return '/api/' + path


def _methods(callback):
    if getattr(callback, 'actions', None):
        return {method: action for method, action in callback.actions.items()
                if method not in ('options', 'head')}
    view = getattr(callback, 'cls', None) or getattr(callback, 'view_class', None)
    if view is None:  # a function view: the live stream
        return {'get': None}
    return {method: None for method in view.http_method_names
            if method not in ('options', 'head') and hasattr(view, method)}


class RouteWalkTests(APITestCase):
    '''
    Every route in the API, called by an Admin who hasn't agreed to the
    organization's terms: whatever reaches the organization is refused, and
    lists leave its records out. A new route fails here until it's gated or
    listed below as reaching no organization.
    '''

    # Routes that reach no organization, by route and method: the user's own
    # account, users (site-wide), and reading and agreeing to the terms.
    UNGATED = {
        ('', 'get'),  # the API's index
        ('login', 'post'), ('user', 'get'), ('user/password', 'post'),
        ('user/agreements', 'get'), ('logout', 'post'), ('version', 'get'),
        ('organizations/<int:organization_id>/contract', 'get'),
        ('organizations/<int:organization_id>/contract/agree', 'post'),
        # Giving up your own edit lease.
        ('leases/<pk>/', 'delete'),
    }

    @classmethod
    def setUpTestData(cls):
        cls.made = made = create_template_event()
        cls.organization = made.organization
        event = made.event
        cls.admin = make_user(roles.ADMIN, 'ada')
        account = models.EmailAccount.objects.create(
            organization=cls.organization, name='Camp mail', host='smtp.example.com', port=587)
        template = models.EmailTemplate.objects.create(
            event=event, purpose='group', name='Packing list', subject='Packing', body='Hi')
        cls.records = {
            models.Organization: cls.organization,
            models.EmailAccount: account,
            models.Event: event,
            models.RegistrationType: made.staff,
            models.PromoCode: models.PromoCode.objects.create(
                event=event, label='Promo', code='SAVE', pricing_logic=25),
            models.Registration: made.r1,
            models.RegistrationDraft: made.draft,
            models.Report: models.Report.objects.create(
                event=event, title='Counts', output='txt', variables_source='server',
                template='{{ campers | length }}'),
            models.Invitation: made.pending,
            models.Lodging: made.cabin_a,
            models.Camper: made.c1,
            models.CustomChargeType: made.linens,
            models.CustomCharge: models.CustomCharge.objects.get(camper=made.c1),
            models.Deposit: models.Deposit.objects.create(
                event=event, amount=Decimal('100.00'), deposited_on=datetime.date(2026, 10, 5)),
            models.Invoice: made.i1,
            models.Payment: models.Payment.objects.filter(registration=made.r1).first(),
            models.PricingOverride: models.PricingOverride.objects.create(
                registration=made.r1, var='donation', amount=Decimal('0'), reason='Waived'),
            models.EmailTemplate: template,
            models.EmailBatch: models.EmailBatch.objects.create(
                event=event, template=template, name='Packing list',
                recipient_source='registrations', account=account),
            models.EmailMessage: models.EmailMessage.objects.create(
                event=event, kind='group', to='pat@example.com', subject='Hello', text='Hi',
                from_email='camp@example.com', next_attempt_at=timezone.now()),
            models.EmailUnsubscribe: models.EmailUnsubscribe.objects.create(
                event=event, email='pat@example.com', source='admin'),
            models.EditLease: models.EditLease.objects.create(
                content_type=ContentType.objects.get_for_model(models.Registration),
                object_id=made.r1.pk, event=event, user=cls.admin, client_id='tab',
                acquired_at=timezone.now(), expires_at=timezone.now() + datetime.timedelta(1)),
            User: cls.admin,
        }
        cls.contract = publish_contract(cls.organization)
        cls.records[models.Contract] = cls.contract
        # The body a write sends: every record it could name, all the organization's.
        cls.body = {
            name: cls.records[model].pk for name, model in contracts.NAMED_RECORDS.items()}
        cls.body.update({'model': 'registration', 'object_id': made.r1.pk, 'client_id': 'tab'})

    def setUp(self):
        self.client.force_login(self.admin)

    def model_of(self, callback):
        view = callback.cls
        if view.queryset is not None:
            return view.queryset.model
        instance = view()
        instance.action = 'retrieve'
        return instance.get_serializer_class().Meta.model

    def call(self, method, path, **kwargs):
        return getattr(self.client, method)(path, **kwargs)

    def routes(self):
        for pattern in api_urls.urlpatterns:
            if 'format' in pattern.pattern.regex.groupindex:
                continue
            yield pattern

    def test_every_route_that_reaches_the_organization_is_gated(self):
        values = {
            'event_id': self.made.event.pk,
            'report_id': self.records[models.Report].pk,
            'invitation_id': self.made.pending.pk,
            'organization_id': self.organization.pk,
        }
        checked = 0
        for pattern in self.routes():
            callback = pattern.callback
            view = getattr(callback, 'cls', None)
            route = str(pattern.pattern)
            if view is not None and all(
                    getattr(p, '__name__', '') == 'AllowAny'
                    for p in view.permission_classes):
                continue  # public: registrants never meet the gate
            if getattr(callback, 'view_class', None) is not None and view is None:
                continue  # a plain Django view (unsubscribing), public
            if view is not None and view.__name__ in SITE_WIDE_VIEWS:
                continue  # users and apps are site-wide
            names = set(pattern.pattern.regex.groupindex)
            pattern_values = dict(values)
            if 'pk' in names:
                pattern_values['pk'] = self.records[self.model_of(callback)].pk
            path = _fill_route(pattern, pattern_values)
            self.assertIsNotNone(path, f'No value for a parameter of {route}')
            for method, action in _methods(callback).items():
                plain_route = route.replace('(?P<pk>[^/.]+)', '<pk>').strip('^$')
                if (plain_route, method) in self.UNGATED:
                    continue
                with self.subTest(route=route, method=method):
                    checked += 1
                    self.check_route(callback, names, path, method, action)
        self.assertGreater(checked, 60)

    def check_route(self, callback, names, path, method, action):
        if names:
            # A record or id in the URL is enough.
            response = self.call(method, path)
            if response.status_code == 405:
                return  # the view doesn't offer it
            self.assertTrue(is_gated(response, self.organization),
                            f'{method.upper()} {path}: {response.status_code}')
            return
        if method == 'get':
            response = self.call(method, path, data={'event': self.made.event.pk})
            self.assertTrue(is_gated(response, self.organization),
                            f'GET {path}?event=: {response.status_code}')
            if action == 'list':
                self.check_unscoped_list(callback, path)
            return
        response = self.call(method, path, data=self.body, format='json')
        self.assertTrue(is_gated(response, self.organization),
                        f'{method.upper()} {path}: {response.status_code}')

    def check_unscoped_list(self, callback, path):
        response = self.client.get(path)
        if response.status_code == 400:
            return  # it needs a filter, which is checked above
        self.assertEqual(response.status_code, 200, path)
        rows = response.data.get('results', response.data) \
            if isinstance(response.data, dict) else response.data
        model = self.model_of(callback)
        if getattr(callback.cls, 'lists_every_organization', False):
            return
        gated = set(model._base_manager.filter(
            contracts.pending_q(model, [self.organization.pk])).values_list('pk', flat=True)) \
            if contracts.organization_paths(model) else set()
        listed = {row['id'] for row in rows}
        self.assertFalse(listed & gated, f'{path} lists the organization\'s records')

    def test_the_live_stream(self):
        response = self.client.get(f'/api/events/{self.made.event.pk}/stream/')
        self.assertTrue(is_gated(response, self.organization), response.status_code)

    def test_an_api_token_is_gated_too(self):
        token = authentication.issue_token(self.admin)
        client = Client()
        response = client.get(f'/api/events/{self.made.event.pk}/',
                              HTTP_AUTHORIZATION=f'Token {token.key}')
        self.assertTrue(is_gated(response, self.organization))

    def test_once_agreed_everything_is_reachable(self):
        agree(self.client, self.organization)
        self.assertEqual(self.client.get(f'/api/events/{self.made.event.pk}/').status_code, 200)
        response = self.client.get('/api/campers/', {'event': self.made.event.pk})
        self.assertEqual(len(response.data), 3)

    def test_other_organizations_are_unaffected(self):
        other = models.Organization.objects.create(name='Other camp')
        event = models.Event.objects.create(organization=other, name='Other camp')
        response = self.client.get('/api/events/')
        self.assertEqual([row['id'] for row in response.data], [event.pk])
        self.assertEqual(self.client.get(f'/api/events/{event.pk}/').status_code, 200)

    def test_the_organization_chooser_lists_every_organization(self):
        response = self.client.get('/api/organizations/')
        self.assertEqual([row['id'] for row in response.data], [self.organization.pk])

    def test_the_password_comes_first(self):
        accounts.set_must_change_password(self.admin, True)
        response = self.client.get(f'/api/events/{self.made.event.pk}/')
        self.assertEqual(response.data['code'], 'password_change_required')

    def test_the_django_admin_isnt_gated(self):
        superuser = make_user(roles.ADMIN, 'root', django_access=roles.SUPERUSER)
        self.client.force_login(superuser)
        self.assertEqual(self.client.get('/django-admin/camphoric/contract/').status_code, 200)
        self.assertEqual(
            self.client.get('/django-admin/camphoric/contractagreement/').status_code, 200)
        self.assertEqual(self.client.get('/django-admin/camphoric/event/').status_code, 200)


class OtherWaysToReachTests(APITestCase):
    '''
    What reaches a gated organization other than by an id a route or filter
    names plainly: ids written another way, references from another
    organization's records, deleted lists, an account's email, a user's history.
    '''

    @classmethod
    def setUpTestData(cls):
        cls.made = create_template_event()
        cls.gated = cls.made.organization
        cls.open = models.Organization.objects.create(name='Open camp')
        cls.open_event = models.Event.objects.create(organization=cls.open, name='Open camp')
        cls.admin = make_user(roles.ADMIN, 'ada')
        cls.account = models.EmailAccount.objects.create(
            organization=cls.gated, name='Camp mail', host='smtp.example.com', port=587)
        cls.made.r1.soft_delete()
        publish_contract(cls.gated)

    def setUp(self):
        self.client.force_login(self.admin)

    def assert_gated(self, response):
        self.assertTrue(is_gated(response, self.gated), (response.status_code, response.data))

    def test_ids_written_another_way(self):
        event = self.made.event.pk
        for query in ({'event': f'+{event}'}, {'event': f' {event} '},
                      {'registration': f'+{self.made.r1.pk}'}):
            with self.subTest(query=query):
                self.assert_gated(self.client.get('/api/registrations/deleted/', query))
        for body in ({'event': f'+{event}'}, {'event': float(event)}, {'event': [event]}):
            with self.subTest(body=body):
                response = self.client.post('/api/deposits/', {
                    **body, 'amount': '1.00', 'deposited_on': '2026-10-05'}, format='json')
                self.assert_gated(response)
        self.assertFalse(models.Deposit.objects.exists())

    def test_a_deleted_list_leaves_out_what_it_cant_tell_by_its_filter(self):
        # Every deleted registration, by a filter the gate doesn't read.
        response = self.client.get('/api/registrations/deleted/', {'registration': '0x1'})
        self.assertNotEqual(response.status_code, 200, 'an id the API itself refuses')
        agree(self.client, self.gated)
        response = self.client.get('/api/registrations/deleted/', {'event': self.made.event.pk})
        self.assertEqual([row['id'] for row in response.data], [self.made.r1.pk])

    def test_a_reference_from_another_organizations_record(self):
        lodging = models.Lodging.objects.create(event=self.open_event, name='Cabins')
        promo = models.PromoCode.objects.create(
            event=self.open_event, label='Promo', code='SAVE', pricing_logic=25)
        for path, body in (
            (f'/api/events/{self.open_event.pk}/', {'email_account': self.account.pk}),
            (f'/api/lodgings/{lodging.pk}/', {'parent': self.made.cabin_a.pk}),
        ):
            with self.subTest(path=path):
                self.assert_gated(self.client.patch(path, body, format='json'))
        self.open_event.refresh_from_db()
        self.assertIsNone(self.open_event.email_account)
        # (A promo code's own check refuses another event's types first.)
        response = self.client.patch(f'/api/promocodes/{promo.pk}/',
                                     {'excluded_registration_types': [self.made.staff.pk]},
                                     format='json')
        self.assertIn(response.status_code, (400, 403))

    def test_a_list_of_references(self):
        request = mock.Mock(user=User.objects.get(pk=self.admin.pk))
        with self.assertRaises(contracts.ContractAgreementRequired):
            contracts.check_related(request, {'types': [self.open_event, self.made.staff]})
        contracts.check_related(request, {'types': [self.open_event]})

    def test_every_writing_serializer_checks_what_it_resolves(self):
        for pattern in api_urls.urlpatterns:
            view = getattr(pattern.callback, 'cls', None)
            serializer = getattr(view, 'serializer_class', None)
            if serializer is None or not issubclass(serializer, drf_serializers.ModelSerializer):
                continue
            if serializer is serializers.RegistrationDraftSerializer:
                continue  # drafts can't be written through the API
            with self.subTest(view=view.__name__):
                self.assertTrue(issubclass(serializer, serializers.ModelSerializer))

    def test_an_accounts_email_without_an_event(self):
        message = models.EmailMessage.objects.create(
            kind='account', to='ops@example.com', subject='Test', text='Hi',
            from_email='camp@example.com', account=self.account,
            next_attempt_at=timezone.now())
        self.assert_gated(self.client.get(f'/api/emailmessages/{message.pk}/'))
        self.assert_gated(self.client.get('/api/emailmessages/', {'account': self.account.pk}))
        response = self.client.get('/api/emailmessages/')
        self.assertNotIn(message.pk, [row['id'] for row in response.data['results']])

    def test_a_users_history_leaves_out_the_organization(self):
        reggie = make_user(roles.REGISTRAR, 'reggie')
        content_type = ContentType.objects.get_for_model(models.Camper)
        LogEntry.objects.bulk_create([
            LogEntry(actor=reggie, content_type=content_type, object_id=self.made.c1.pk,
                     object_repr='Pat', action=LogEntry.Action.UPDATE, changes={}),
            LogEntry(actor=reggie, content_type=ContentType.objects.get_for_model(User),
                     object_id=reggie.pk, object_repr='reggie', action=LogEntry.Action.UPDATE,
                     changes={}),
        ])
        response = self.client.get(f'/api/users/{reggie.pk}/history/')
        self.assertEqual([e['object']['type'] for e in response.data['results']], ['user'])
        agree(self.client, self.gated)
        response = self.client.get(f'/api/users/{reggie.pk}/history/')
        self.assertEqual(len(response.data['results']), 2)


class LiveStreamRecheckTests(TestCase):
    def test_a_new_version_ends_its_streams(self):
        organization = models.Organization.objects.create(name='Camp')
        user = make_user(roles.REGISTRAR, 'reggie')
        client = Client()
        client.force_login(user)
        key = client.session.session_key
        with mock.patch.object(live_stream.connection, 'close'):
            self.assertTrue(live_stream.still_allowed(key, user.id, organization.pk))
            publish_contract(organization)
            self.assertFalse(live_stream.still_allowed(key, user.id, organization.pk))

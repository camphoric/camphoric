'''
Downloading all of an event's data as JSON (camphoric.event_export, SPEC
§8.8, DR-169): what's in it, what's kept out of it, who may download it, and
the record of each download.
'''

import datetime
from decimal import Decimal
import json
from urllib.parse import quote

from auditlog.models import LogEntry
from django.db import connection
from django.test import SimpleTestCase, TestCase, TransactionTestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from freezegun import freeze_time
from rest_framework.test import APIClient, APITestCase

from camphoric import api_tokens, event_export, models, roles
from camphoric.mail import unsubscribe
from tests.factories import create_template_event, make_user

NOW = datetime.datetime(2026, 11, 18, 5, 30, tzinfo=datetime.UTC)  # the 17th in Pacific time

SECTIONS = [
    'registration_types', 'promo_codes', 'custom_charge_types', 'lodgings', 'reports',
    'email_templates', 'contracts', 'registrations', 'invitations', 'campers',
    'custom_charges', 'pricing_overrides', 'deposits', 'invoices', 'payments',
    'contract_agreements', 'email_messages', 'email_batches', 'email_unsubscribes',
]


def publish_contract(organization, body):
    contract = models.Contract.objects.create(
        organization=organization, number=1, body=body, content_sha256='a' * 64,
        published_at=timezone.now())
    return contract


def agree(organization, contract, user, **fields):
    return models.ContractAgreement.objects.create(
        organization=organization, contract=contract, user=user, agreed_at=timezone.now(),
        username=user.username, content_sha256=contract.content_sha256,
        assent_text='I agree', **fields)


class ExportTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.made = made = create_template_event()
        cls.event = event = made.event
        cls.admin = make_user(roles.ADMIN, 'ada', first_name='Ada', last_name='Admin')
        cls.account = models.EmailAccount.objects.create(
            organization=made.organization, name='Camp mail', host='smtp.example.com', port=587,
            username='camp', password='hunter2-smtp-password')
        event.email_account = cls.account
        event.paypal_client_id = 'paypal-client-id-xyz'
        event.save()

        cls.promo = models.PromoCode.objects.create(
            event=event, label='Early', code='EARLY', pricing_logic=10)
        cls.promo.excluded_registration_types.add(made.staff)
        cls.deposit = models.Deposit.objects.create(event=event, amount=Decimal('100.00'))
        cls.payment = made.r1.payment_set.get()
        cls.payment.deposit = cls.deposit
        cls.payment.save()
        cls.override = models.PricingOverride.objects.create(
            registration=made.r1, camper=made.c1, var='tuition', amount=Decimal('300.00'),
            reason='Scholarship')
        cls.report = models.Report.objects.create(event=event, title='Roster', template='x')
        # Soft-deleted records are in it, with when they were deleted.
        cls.deleted_camper = made.r1.campers.create(
            sequence=2, attributes={'first_name': 'Gone'})
        cls.deleted_camper.soft_delete()

        # An invoice email, with its pay link; an invitation, with its register
        # link; and a group email, with its unsubscribe link.
        cls.unsubscribe_url = unsubscribe.unsubscribe_url(
            'https://reg.example.org', event.id, 'pat@example.com')
        cls.messages = [
            models.EmailMessage.objects.create(
                event=event, kind='invoice', registration=made.r1, from_email='camp@example.com',
                to='pat@example.com', subject='Invoice',
                text=f'Pay here: https://reg.example.org/invoices/{made.i1.token} today',
                html=f'<a href="https://reg.example.org/invoices/{made.i1.token}">Pay</a>'),
            models.EmailMessage.objects.create(
                event=event, kind='invitation', invitation=made.pending,
                from_email='camp@example.com', to='kim@example.com', subject='Join us',
                text=('[Register here](https://reg.example.org/events/1/register'
                      f'?email=kim@example.com&code={made.pending.invitation_code})'),
                html=('<a href="https://reg.example.org/events/1/register?email=kim@example.com'
                      f'&amp;code={made.pending.invitation_code}">Register</a>')),
            # A template may print the code and the registration's uuid on their own.
            models.EmailMessage.objects.create(
                event=event, kind='invitation', invitation=made.pending,
                from_email='camp@example.com', to='kim@example.com', subject='Your code',
                text=f'Your code is {made.pending.invitation_code.upper()}.',
                html=(f'<p>Code: <strong>{made.pending.invitation_code}</strong></p>'
                      f'<p>Reference {made.r1.uuid}</p>')),
            models.EmailMessage.objects.create(
                event=event, kind='bulk', from_email='camp@example.com', to='pat@example.com',
                subject='News', text=f'Hi\n\nUnsubscribe: {cls.unsubscribe_url}',
                html=f'<p>Hi</p><a href="{cls.unsubscribe_url}">Unsubscribe</a>',
                unsubscribe_url=cls.unsubscribe_url),
        ]
        cls.batch = models.EmailBatch.objects.create(
            event=event, name='News', recipient_source='campers')
        cls.unsubscribed = models.EmailUnsubscribe.objects.create(
            event=event, email='quiet@example.com', source='admin')

        cls.contract = publish_contract(made.organization, 'Our terms')
        # A draft of the next version isn't in it: it's still being written.
        cls.draft_contract = models.Contract.objects.create(
            organization=made.organization, body='Draft terms')
        cls.agreement = agree(
            made.organization, cls.contract, cls.admin, ip_address='192.0.2.1',
            user_agent='Firefox')
        cls.token, cls.token_key = api_tokens.issue(cls.admin, 'Scripts', None)

        # Another event of the same organization, and another organization.
        cls.other = other = models.Event.objects.create(
            organization=made.organization, name='Other Camp')
        other_type = models.RegistrationType.objects.create(
            event=other, name='staff', label='Staff')
        other_lodging = models.Lodging.objects.create(event=other, name='Lodge')
        other_registration = models.Registration.objects.create(
            event=other, registrant_email='else@example.com')
        cls.theirs = {
            'registration_types': [other_type.id],
            'lodgings': [other_lodging.id],
            'registrations': [other_registration.id],
            'campers': [other_registration.campers.create(lodging=other_lodging).id],
            'invoices': [models.Invoice.objects.create(
                registration=other_registration, origin='admin', amount=Decimal('5.00')).id],
            'invitations': [models.Invitation.objects.create(
                registration_type=other_type, recipient_email='else@example.com').id],
            'email_messages': [models.EmailMessage.objects.create(
                event=other, kind='test', from_email='a@example.com', to='b@example.com',
                subject='Other', text='Other').id],
            'email_templates': list(models.EmailTemplate.objects.filter(event=other)
                                    .values_list('id', flat=True)),
            'contracts': [publish_contract(
                models.Organization.objects.create(name='Other Org'), 'Their terms').id],
        }

    def setUp(self):
        self.client.force_authenticate(user=self.admin)

    def download(self, **kwargs):
        with freeze_time(NOW):
            response = self.client.get(f'/api/events/{self.event.id}/export/', **kwargs)
        self.assertEqual(response.status_code, 200)
        body = b''.join(response.streaming_content).decode()
        return response, body

    def export(self):
        return json.loads(self.download()[1])

    def ids(self, data, section):
        return sorted(row['id'] for row in data[section])

    def test_the_response_is_an_attachment_named_for_the_event(self):
        response, _ = self.download()
        self.assertEqual(response['Content-Type'], 'application/json')
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(
            response['Content-Disposition'],
            'attachment; filename="Test Camp data 2026-11-17.json"')

    def test_a_name_that_is_not_plain_ascii(self):
        self.event.name = 'Été: camp/2026'
        self.event.save()
        response, _ = self.download()
        name = 'Été- camp-2026 data 2026-11-17.json'
        self.assertEqual(
            response['Content-Disposition'], f"attachment; filename*=utf-8''{quote(name)}")

    @override_settings(CAMPHORIC_VERSION='1.4.0')
    def test_what_describes_it_comes_first(self):
        _, body = self.download()
        self.assertTrue(body.startswith('{"export": '))
        data = json.loads(body)
        self.assertEqual(data['export'], {
            'format': 'camphoric-event-data',
            'format_version': 1,
            'camphoric_version': '1.4.0',
            'exported_at': '2026-11-18T05:30:00Z',
            'exported_by': {'id': self.admin.id, 'username': 'ada', 'name': 'Ada Admin'},
            'event': {'id': self.event.id, 'name': 'Test Camp'},
        })
        self.assertEqual(data['organization'], {
            'id': self.made.organization.id, 'name': 'Camp Org'})
        self.assertEqual(list(data), ['export', 'organization', 'event', *SECTIONS])

    def test_without_a_release_version(self):
        self.assertIsNone(self.export()['export']['camphoric_version'])

    def test_the_event_has_all_its_fields_and_relations_by_id(self):
        event = self.export()['event']
        self.assertEqual(event['id'], self.event.id)
        self.assertEqual(event['organization'], self.made.organization.id)
        self.assertEqual(event['email_account'], self.account.id)
        self.assertEqual(event['confirmation_template'], self.event.confirmation_template_id)
        self.assertEqual(event['pricing'], {'adult': 400, 'linen_rate': 25})
        self.assertEqual(event['registration_schema']['properties']['comments']['title'],
                         'Comments')
        for field in ('created_at', 'updated_at', 'deleted_at', 'version', 'time_zone'):
            self.assertIn(field, event)

    def test_every_kind_of_record_of_the_event(self):
        data = self.export()
        made = self.made
        expected = {
            'registration_types': [made.staff.id],
            'promo_codes': [self.promo.id],
            'custom_charge_types': [made.linens.id],
            'lodgings': sorted(models.Lodging.objects.filter(event=self.event)
                               .values_list('id', flat=True)),
            'reports': [self.report.id],
            'email_templates': sorted(models.EmailTemplate.objects.filter(event=self.event)
                                      .values_list('id', flat=True)),
            'contracts': [self.contract.id],
            'registrations': [made.r1.id, made.r2.id],
            'invitations': [made.invited.id, made.pending.id],
            'campers': [made.c1.id, made.c2.id, made.c3.id, self.deleted_camper.id],
            'custom_charges': sorted(models.CustomCharge.objects
                                     .filter(camper__registration__event=self.event)
                                     .values_list('id', flat=True)),
            'pricing_overrides': [self.override.id],
            'deposits': [self.deposit.id],
            'invoices': [made.i1.id, made.i2.id],
            'payments': sorted(models.Payment.objects.filter(registration__event=self.event)
                               .values_list('id', flat=True)),
            'contract_agreements': [self.agreement.id],
            'email_messages': [message.id for message in self.messages],
            'email_batches': [self.batch.id],
            'email_unsubscribes': [self.unsubscribed.id],
        }
        self.assertEqual(list(expected), SECTIONS)
        for section, ids in expected.items():
            with self.subTest(section=section):
                self.assertTrue(ids)
                self.assertEqual(self.ids(data, section), sorted(ids))

    def test_relations_are_ids_so_records_can_be_joined(self):
        data = self.export()
        by_id = {section: {row['id']: row for row in data[section]} for section in SECTIONS}
        made = self.made
        camper = by_id['campers'][made.c1.id]
        self.assertEqual(camper['registration'], made.r1.id)
        self.assertEqual(camper['lodging'], made.cabin_a.id)
        self.assertEqual(camper['lodging_requested'], made.cabin_a.id)
        self.assertEqual(camper['attributes']['emergency_contact'], {'name': 'Jo', 'phone': '555'})
        self.assertEqual(by_id['lodgings'][made.cabin_a.id]['parent'], made.cabins.id)
        self.assertIsNone(by_id['lodgings'][made.root.id]['parent'])
        payment = by_id['payments'][self.payment.id]
        self.assertEqual(payment['invoice'], made.i1.id)
        self.assertEqual(payment['deposit'], self.deposit.id)
        self.assertEqual(payment['amount'], '100.00')
        self.assertEqual(by_id['registrations'][made.r2.id]['registration_type'], made.staff.id)
        self.assertEqual(
            by_id['registrations'][made.r1.id]['attributes']['address']['city'], 'Berkeley')
        self.assertEqual(by_id['promo_codes'][self.promo.id]['excluded_registration_types'],
                         [made.staff.id])
        self.assertEqual(by_id['pricing_overrides'][self.override.id]['camper'], made.c1.id)
        self.assertEqual(by_id['contract_agreements'][self.agreement.id]['contract'],
                         self.contract.id)
        self.assertEqual(by_id['email_messages'][self.messages[1].id]['invitation'],
                         made.pending.id)

    def test_soft_deleted_records_are_in_it_with_when_they_were_deleted(self):
        campers = {row['id']: row for row in self.export()['campers']}
        self.assertIsNotNone(campers[self.deleted_camper.id]['deleted_at'])
        self.assertIsNone(campers[self.made.c1.id]['deleted_at'])

    def test_nothing_of_another_event_or_organization(self):
        data = self.export()
        for section, ids in self.theirs.items():
            with self.subTest(section=section):
                self.assertTrue(ids)
                self.assertFalse(set(ids) & set(self.ids(data, section)))
        self.assertNotIn('drew@example.com', json.dumps(data))  # a draft isn't in it

    def test_no_secret_is_in_it(self):
        _, body = self.download()
        made = self.made
        stored_password = models.EmailAccount.objects.filter(pk=self.account.pk) \
            .values_list('password', flat=True).get()
        secrets = {
            'email account password': 'hunter2-smtp-password',
            'its encrypted form': stored_password,
            'PayPal client id': 'paypal-client-id-xyz',
            'invoice link code': made.i1.token,
            'another invoice link code': made.i2.token,
            'invitation code': made.pending.invitation_code,
            'invitation code in capitals': made.pending.invitation_code.upper(),
            'registration uuid': str(made.r1.uuid),
            'another registration uuid': str(made.r2.uuid),
            'draft contract': 'Draft terms',
            'redeemed invitation code': made.invited.invitation_code,
            'unsubscribe link': self.unsubscribe_url,
            'unsubscribe link code': self.unsubscribe_url.rsplit('/', 2)[-2],
            'API token': self.token_key,
            'API token hash': self.token.key_hash,
        }
        for what, secret in secrets.items():
            with self.subTest(secret=what):
                self.assertTrue(secret)
                self.assertNotIn(secret, body)
        data = json.loads(body)
        self.assertNotIn('paypal_client_id', data['event'])
        self.assertNotIn('token', data['invoices'][0])
        self.assertNotIn('invitation_code', data['invitations'][0])
        self.assertNotIn('uuid', data['registrations'][0])
        self.assertNotIn('unsubscribe_url', data['email_messages'][0])
        for key in ('email_accounts', 'users', 'api_tokens', 'connected_apps', 'edit_leases',
                    'registration_drafts', 'sessions'):
            self.assertNotIn(key, data)

    def test_the_email_that_carried_a_link_code_says_where_it_was(self):
        messages = {row['id']: row for row in self.export()['email_messages']}
        invoice, invitation, code, bulk = (messages[message.id] for message in self.messages)
        self.assertEqual(
            invoice['text'], 'Pay here: https://reg.example.org/invoices/[redacted] today')
        self.assertIn('href="https://reg.example.org/invoices/[redacted]"', invoice['html'])
        self.assertIn('?email=kim@example.com&code=[redacted])', invitation['text'])
        self.assertIn('&amp;code=[redacted]"', invitation['html'])
        self.assertEqual(code['text'], 'Your code is [redacted].')
        self.assertEqual(
            code['html'], '<p>Code: <strong>[redacted]</strong></p><p>Reference [redacted]</p>')
        self.assertEqual(
            bulk['text'], 'Hi\n\nUnsubscribe: https://reg.example.org/api/unsubscribe/[redacted]/')
        self.assertEqual(bulk['to'], 'pat@example.com')

    def test_the_download_is_recorded(self):
        self.download()
        entry = LogEntry.objects.get(action=LogEntry.Action.ACCESS)
        self.assertEqual(entry.actor, self.admin)
        self.assertEqual(entry.object_id, self.event.id)
        self.assertEqual(entry.content_type.model, 'event')
        self.assertEqual(entry.timestamp, NOW)
        self.assertEqual(entry.changes, {'data_export': [None, 'Test Camp data 2026-11-17.json']})
        self.assertEqual(entry.additional_data, {'event': self.event.id})

        history = self.client.get(f'/api/users/{self.admin.id}/history/').json()['results']
        self.assertEqual(history[0]['action'], 'export')
        self.assertEqual(history[0]['object'], {
            'type': 'event', 'id': self.event.id, 'label': 'Test Camp'})

    def test_with_a_personal_access_token(self):
        self.client.force_authenticate(user=None)
        response = APIClient().get(
            f'/api/events/{self.event.id}/export/', HTTP_AUTHORIZATION=f'Bearer {self.token_key}')
        self.assertEqual(response.status_code, 200)
        data = json.loads(b''.join(response.streaming_content))
        self.assertEqual(data['export']['exported_by']['username'], 'ada')

    def test_one_query_per_kind_of_record(self):
        # The event, its organization, and each section (two for promo codes and
        # the types they exclude, two for email messages and the invitation codes
        # to take out of them), not one per record; and the savepoint the
        # export's transaction is, within the test's, and its release.
        with self.assertNumQueries(2 + len(SECTIONS) + 2 + 2):
            ''.join(event_export.stream(self.event, self.admin, NOW))


class PermissionTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.event = create_template_event().event
        cls.url = f'/api/events/{cls.event.id}/export/'

    def test_only_an_admin(self):
        expected = {None: 401, 'no role': 403, roles.REPORTER: 403, roles.REGISTRAR: 403,
                    roles.ADMIN: 200}
        for role, status in expected.items():
            with self.subTest(role=role):
                user = None if role is None else make_user(
                    None if role == 'no role' else role, f'user-{role}')
                self.client.force_authenticate(user=user)
                self.assertEqual(self.client.get(self.url).status_code, status)
        self.assertEqual(LogEntry.objects.filter(action=LogEntry.Action.ACCESS).count(), 1)

    def test_no_such_event(self):
        self.client.force_authenticate(user=make_user(roles.ADMIN))
        self.assertEqual(self.client.get('/api/events/99999/export/').status_code, 404)

    def test_only_by_get(self):
        self.client.force_authenticate(user=make_user(roles.ADMIN))
        self.assertEqual(self.client.post(self.url).status_code, 405)

    def test_a_read_only_token_may_download(self):
        _, key = api_tokens.issue(make_user(roles.ADMIN), 'Read', None, read_only=True)
        response = APIClient().get(self.url, HTTP_AUTHORIZATION=f'Bearer {key}')
        self.assertEqual(response.status_code, 200)

    def test_a_registrars_token_may_not(self):
        _, key = api_tokens.issue(make_user(roles.REGISTRAR), 'Read', None)
        response = APIClient().get(self.url, HTTP_AUTHORIZATION=f'Bearer {key}')
        self.assertEqual(response.status_code, 403)


class FileNameTests(SimpleTestCase):
    def event(self, name, time_zone='America/Los_Angeles'):
        return models.Event(id=7, name=name, time_zone=time_zone)

    def test_the_date_is_the_events(self):
        self.assertEqual(event_export.file_name(self.event('Lark Camp 2026'), NOW),
                         'Lark Camp 2026 data 2026-11-17.json')
        self.assertEqual(event_export.file_name(self.event('Lark', 'Europe/London'), NOW),
                         'Lark data 2026-11-18.json')

    def test_characters_not_allowed_in_file_names_are_replaced(self):
        self.assertEqual(
            event_export.file_name(self.event('A/B\\C:D*E?F"G<H>I|J'), NOW),
            'A-B-C-D-E-F-G-H-I-J data 2026-11-17.json')
        self.assertEqual(event_export.file_name(self.event('Lark\tCamp\n 2026 '), NOW),
                         'Lark-Camp- 2026 data 2026-11-17.json')

    def test_a_long_name_is_cut_short(self):
        name = event_export.file_name(self.event('Camp ' * 60), NOW)
        self.assertEqual(len(name.encode()), 255)
        self.assertTrue(name.endswith('Camp data 2026-11-17.json'))
        # Never in the middle of a character.
        name = event_export.file_name(self.event('Été ' * 100), NOW)
        self.assertLessEqual(len(name.encode()), 255)
        self.assertTrue(name.endswith(' data 2026-11-17.json'))
        name.encode().decode()

    def test_a_blank_name(self):
        self.assertEqual(event_export.file_name(self.event('  '), NOW),
                         'event 7 data 2026-11-17.json')


class RedactTests(SimpleTestCase):
    def test_link_codes(self):
        self.assertEqual(
            event_export.redact('see https://x.org/invoices/AbC-12_xY and '
                                'https://x.org/events/3/register?email=a%40b.org&code=abcd2345'),
            'see https://x.org/invoices/[redacted] and '
            'https://x.org/events/3/register?email=a%40b.org&code=[redacted]')
        self.assertEqual(event_export.redact('<https://x.org/api/unsubscribe/.eJy:1a:Zz/>'),
                         '<https://x.org/api/unsubscribe/[redacted]/>')

    def test_codes_on_their_own(self):
        self.assertEqual(
            event_export.redact('Code ABCD2345, or abcd2345; not abcd2346.', {'abcd2345'}),
            'Code [redacted], or [redacted]; not abcd2346.')
        self.assertEqual(
            event_export.redact('Ref 0B5E9D4C-1f2a-4b3c-8d9e-0123456789ab.'), 'Ref [redacted].')

    def test_other_text_is_left_alone(self):
        text = 'Your zip code: 94110. Invoices are due Friday, 2026-11-17.'
        self.assertEqual(event_export.redact(text, {'abcd2345'}), text)


class AsynchronousTests(SimpleTestCase):
    '''What the ASGI server sends: the same text, in batches, closing what it reads from.'''

    async def test_the_same_text_in_batches(self):
        chunks = [f'{i:05d}' for i in range(30000)]
        batches = [batch async for batch in event_export.asynchronous(iter(chunks))]
        self.assertEqual(''.join(batches), ''.join(chunks))
        self.assertGreater(len(batches), 1)
        self.assertLess(len(batches), 10)

    async def test_stopping_early_closes_the_source(self):
        closed = []

        def source():
            try:
                while True:
                    yield 'x' * 70000
            finally:
                closed.append(True)

        batches = event_export.asynchronous(source())
        self.assertEqual(len(await anext(batches)), 70000)
        await batches.aclose()
        self.assertEqual(closed, [True])


class AsgiTests(TestCase):
    '''Under the ASGI server (as in production), it's sent as it's built.'''

    @classmethod
    def setUpTestData(cls):
        cls.event = create_template_event().event
        cls.admin = make_user(roles.ADMIN)

    async def test_an_async_stream(self):
        await self.async_client.aforce_login(self.admin)
        response = await self.async_client.get(f'/api/events/{self.event.id}/export/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.is_async)
        body = b''.join([chunk async for chunk in response.streaming_content])
        data = json.loads(body)
        self.assertEqual(data['export']['event']['id'], self.event.id)
        self.assertEqual(len(data['registrations']), 2)


class RealTransactionTests(TransactionTestCase):
    '''Outside a test's transaction, as when serving: its own REPEATABLE READ one.'''

    def test_read_from_one_snapshot_which_ends_before_anything_is_sent(self):
        event = create_template_event().event
        admin = make_user(roles.ADMIN)
        chunks = event_export.stream(event, admin, timezone.now())
        with CaptureQueriesContext(connection) as queries:
            first = next(chunks)
        # Set before anything is read (after psycopg's BEGIN).
        reads = [query['sql'] for query in queries.captured_queries if query['sql'] != 'BEGIN']
        self.assertEqual(reads[0], 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
        self.assertFalse(connection.in_atomic_block)
        # Changes made while it's sent aren't in it.
        models.Registration.objects.update(registrant_email='changed@example.com')
        data = json.loads(first + ''.join(chunks))
        self.assertEqual({row['registrant_email'] for row in data['registrations']},
                         {'pat@example.com', 'lee@example.com'})


class SnapshotTests(APITestCase):
    def test_the_export_reads_in_one_transaction(self):
        # (A test runs in a transaction already, which the export uses.)
        event = create_template_event().event
        self.assertTrue(connection.in_atomic_block)
        chunks = event_export.stream(event, make_user(roles.ADMIN), timezone.now())
        self.assertTrue(json.loads(''.join(chunks))['registrations'])

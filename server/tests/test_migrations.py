'''
The data migrations of incomplete registrations (SPEC DR-139, DR-140, DR-141).
They read `Registration.completed`, since removed, so they run here on the models
as they were, one migration back, and not on today's.
'''

import datetime
from decimal import Decimal
from importlib import import_module

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone

BEFORE_REMOVING = '0089_registration_draft'
REMOVING = '0090_remove_registration_completed'
UPDATE = 1


def migrate_to(name):
    '''Migrate to `name`, and return the models as they are there.'''
    target = [('camphoric', name)]
    MigrationExecutor(connection).migrate(target)
    return MigrationExecutor(connection).loader.project_state(target).apps


def migrate_to_latest():
    '''Migrate forward to the app's latest migration, for the tests that follow.'''
    executor = MigrationExecutor(connection)
    executor.migrate(executor.loader.graph.leaf_nodes('camphoric'))


def migration(name):
    return import_module(f'camphoric.migrations.{name}')


class MigrationTestCase(TransactionTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.apps = migrate_to(BEFORE_REMOVING)

    @classmethod
    def tearDownClass(cls):
        migrate_to_latest()
        super().tearDownClass()

    def setUp(self):
        for name in ('Camper', 'CustomCharge', 'CustomChargeType', 'Event', 'Invitation', 'Invoice',
                     'Lodging', 'Organization', 'Payment', 'PricingOverride', 'Registration',
                     'RegistrationDraft', 'RegistrationType'):
            setattr(self, name, self.apps.get_model('camphoric', name))
        self.LogEntry = self.apps.get_model('auditlog', 'LogEntry')
        self.ContentType = self.apps.get_model('contenttypes', 'ContentType')
        organization = self.Organization.objects.create(name='Org')
        self.event = self.Event.objects.create(organization=organization, name='Camp')

    def registration(self, **fields):
        return self.Registration.objects.create(
            event=self.event, registrant_email=fields.pop('email', 'pat@example.com'), **fields)

    def camper(self, registration, **fields):
        return self.Camper.objects.create(
            registration=registration, attributes=fields.pop('attributes', {'name': 'Pat'}),
            **fields)

    def count(self, model):
        return model._base_manager.count()


class RecordingStartedInvitationsTests(MigrationTestCase):
    '''0087 ties registrations started before it to their invitations.'''

    def setUp(self):
        super().setUp()
        self.staff = self.RegistrationType.objects.create(
            event=self.event, name='staff', label='Staff')
        self.invitation = self.Invitation.objects.create(
            registration_type=self.staff, recipient_email='lee@example.com',
            invitation_code='ABC')

    def migrate(self):
        migration('0087_registration_started_with_invitation').record_started_invitations(
            self.apps, None)

    def started(self, **fields):
        return self.registration(
            email='lee@example.com', registration_type=self.staff, **fields)

    def link(self, invitation, registration):
        invitation.registration = registration
        invitation.save()

    def test_the_registration_an_invitation_links_to_was_started_with_it(self):
        started = self.started()
        self.link(self.invitation, started)
        self.migrate()
        started.refresh_from_db()
        self.assertEqual(started.started_with_invitation_id, self.invitation.id)

    def test_one_completed_before_another_was_started_redeems_it(self):
        # Start A, start B (the invitation moved to B), complete A.
        completed = self.registration(
            email='Lee@Example.com', registration_type=self.staff, completed=True)
        self.link(self.invitation, self.started())
        self.migrate()
        completed.refresh_from_db()
        self.invitation.refresh_from_db()
        self.assertEqual(completed.started_with_invitation_id, self.invitation.id)
        self.assertEqual(self.invitation.registration_id, completed.id)

    def test_it_takes_no_guess_between_two(self):
        for _ in range(2):
            self.started(completed=True)
        started = self.started()
        self.link(self.invitation, started)
        self.migrate()
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.registration_id, started.id)

    def test_one_another_invitation_links_to_is_left_to_it(self):
        other = self.Invitation.objects.create(
            registration_type=self.staff, recipient_email='lee@example.com',
            invitation_code='DEF')
        self.link(other, self.started(completed=True))
        started = self.started()
        self.link(self.invitation, started)
        self.migrate()
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.registration_id, started.id)


class EntriesBeforeCompletionTests(MigrationTestCase):
    '''0088 deletes what the log holds from before completion.'''

    GONE = 987654

    def setUp(self):
        super().setUp()
        self.registration_type, _ = self.ContentType.objects.get_or_create(
            app_label='camphoric', model='registration')
        self.camper_type, _ = self.ContentType.objects.get_or_create(
            app_label='camphoric', model='camper')

    def migrate(self):
        migration('0088_audit_starts_at_completion').delete_entries_before_completion(
            self.apps, None)

    def entry(self, registration_id, changes=None, content_type=None, **tags):
        return self.LogEntry.objects.create(
            content_type=content_type or self.registration_type,
            object_pk=str(registration_id), object_id=registration_id, object_repr='r',
            action=UPDATE, changes=changes or {'attributes': ['{}', '{"comments": "Hi"}']},
            additional_data={'registration': registration_id, **tags})

    def remaining(self, *entries):
        return [entry for entry in entries
                if self.LogEntry.objects.filter(id=entry.id).exists()]

    def test_a_registration_not_completed_loses_everything(self):
        incomplete = self.registration()
        entries = (self.entry(incomplete.id),
                   self.entry(incomplete.id, content_type=self.camper_type))
        self.migrate()
        self.assertEqual(self.remaining(*entries), [])

    def test_one_with_money_on_it_keeps_its_history(self):
        # It's about to become an ordinary registration (0090): who recorded what stays.
        invoiced = self.registration()
        self.Invoice.objects.create(registration=invoiced, origin='admin', amount=Decimal('5'))
        paid = self.registration()
        self.Payment.objects.create(
            registration=paid, invoice=self.Invoice.objects.create(
                registration=paid, origin='admin', amount=Decimal('5')), amount=Decimal('5.00'))
        entries = (self.entry(invoiced.id), self.entry(paid.id))
        self.migrate()
        self.assertEqual(self.remaining(*entries), list(entries))

    def test_a_deleted_incomplete_registration_loses_everything(self):
        deleted = self.registration(deleted_at=timezone.now())
        entry = self.entry(deleted.id)
        self.migrate()
        self.assertEqual(self.remaining(entry), [])

    def test_one_the_clean_up_deleted_loses_everything(self):
        entries = (self.entry(self.GONE, {'completed': ['None', 'False']}),
                   self.entry(self.GONE, {'completed': ['False', 'None']}))
        self.migrate()
        self.assertEqual(self.remaining(*entries), [])

    def test_a_completed_registration_keeps_only_what_followed_completion(self):
        completed = self.registration(completed=True)
        before = self.entry(completed.id)
        completion = self.entry(completed.id, {'completed': ['False', 'True']})
        after = self.entry(completed.id)
        self.migrate()
        self.assertEqual(self.remaining(before, completion, after), [completion, after])

    def test_it_counts_from_the_first_completion(self):
        completed = self.registration(completed=True)
        first = self.entry(completed.id, {'completed': ['False', 'True']})
        between = self.entry(completed.id, {'completed': ['True', 'False']})
        second = self.entry(completed.id, {'completed': ['False', 'True']})
        self.migrate()
        self.assertEqual(self.remaining(first, between, second), [first, between, second])

    def test_a_completed_one_since_deleted_keeps_what_followed_completion(self):
        before = self.entry(self.GONE)
        completion = self.entry(self.GONE, {'completed': ['False', 'True']})
        deleted = self.entry(self.GONE, {'completed': ['True', 'None']})
        self.migrate()
        self.assertEqual(self.remaining(before, completion, deleted), [completion, deleted])

    def test_a_deleted_one_only_its_last_values_show_was_completed_keeps_everything(self):
        edit = self.entry(self.GONE)
        deleted = self.entry(self.GONE, {'completed': ['True', 'None']})
        self.migrate()
        self.assertEqual(self.remaining(edit, deleted), [edit, deleted])

    def test_one_completed_before_the_log_began_keeps_everything(self):
        edit = self.entry(self.registration(completed=True).id)
        self.migrate()
        self.assertEqual(self.remaining(edit), [edit])

    def test_entries_for_no_registration_are_left_alone(self):
        untagged = self.LogEntry.objects.create(
            content_type=self.camper_type, object_pk='1', object_id=1, object_repr='c',
            action=UPDATE, changes={'x': ['1', '2']})
        kept = self.registration(completed=True)
        no_registration = self.entry(kept.id, registration=None)
        self.migrate()
        self.assertEqual(self.remaining(untagged, no_registration), [untagged, no_registration])


class IncompleteIntoDraftsTests(MigrationTestCase):
    '''0089 moves incomplete registrations into drafts, and back.'''

    def migrate(self):
        migration(BEFORE_REMOVING).incomplete_registrations_into_drafts(self.apps, None)

    def reverse(self):
        migration(BEFORE_REMOVING).drafts_into_registrations(self.apps, None)

    def test_an_incomplete_one_becomes_a_submitted_draft_under_the_same_uuid(self):
        registration = self.registration(
            attributes={'billing_name': 'Pat'},
            server_pricing_results={'total': 0, 'campers': [{'total': 0}]})
        self.camper(registration, sequence=0)
        self.migrate()

        self.assertEqual(self.count(self.Registration), 0)
        self.assertEqual(self.count(self.Camper), 0)
        draft = self.RegistrationDraft.objects.get(uuid=registration.uuid)
        self.assertIsNotNone(draft.submitted_at)
        self.assertEqual(draft.server_pricing_results['total'], 0)
        self.assertEqual(draft.form_data, {
            'billing_name': 'Pat', 'registrant_email': 'pat@example.com',
            'campers': [{'name': 'Pat'}]})

    def test_lodging_they_asked_for_comes_across(self):
        lodging = self.Lodging.objects.create(event=self.event, name='Cabin')
        registration = self.registration(attributes={})
        self.camper(registration, sequence=0)
        self.camper(registration, sequence=1, attributes={'name': 'Lee'},
                    lodging_requested=lodging, lodging_shared=True, lodging_shared_with='Pat',
                    lodging_comments='Near the lake')
        self.migrate()
        camper = self.RegistrationDraft.objects.get().form_data['campers'][1]
        self.assertEqual(camper['lodging'], {
            'lodging_requested': {'id': lodging.id}, 'lodging_shared': True,
            'lodging_shared_with': 'Pat', 'lodging_comments': 'Near the lake'})

    def test_its_invitation_and_activity_come_across(self):
        registration_type = self.RegistrationType.objects.create(
            event=self.event, name='crew', label='Crew')
        invitation = self.Invitation.objects.create(
            registration_type=registration_type, recipient_email='pat@example.com')
        registration = self.registration(
            started_with_invitation=invitation, registration_type=registration_type)
        changed = timezone.now() - datetime.timedelta(days=9)
        self.Registration.objects.filter(id=registration.id).update(updated_at=changed)
        self.migrate()
        draft = self.RegistrationDraft.objects.get()
        self.assertEqual(draft.invitation_id, invitation.id)
        self.assertEqual(draft.registration_type_id, registration_type.id)
        self.assertEqual(draft.last_activity_at, changed)

    def test_those_holding_more_than_a_draft_can_stay(self):
        charged = self.registration()
        charge_type = self.CustomChargeType.objects.create(event=self.event, name='linens')
        self.CustomCharge.objects.create(
            custom_charge_type=charge_type, camper=self.camper(charged), amount=Decimal('1.00'))
        invoice = self.Invoice.objects.create(
            registration=self.registration(), origin='admin', amount=Decimal('5'))
        paid = self.registration()
        self.Payment.objects.create(
            registration=paid, invoice=self.Invoice.objects.create(
                registration=paid, origin='admin', amount=Decimal('5')), amount=Decimal('5.00'))
        self.PricingOverride.objects.create(
            registration=self.registration(), var='total_fee', amount=Decimal('1.00'),
            reason='Why not')
        self.registration(deleted_at=timezone.now())
        self.migrate()
        self.assertEqual(self.count(self.RegistrationDraft), 0)
        self.assertEqual(self.count(self.Registration), 5)
        self.assertTrue(self.Registration.objects.filter(id=invoice.registration_id).exists())

    def test_a_completed_one_is_left_alone(self):
        self.registration(completed=True)
        self.migrate()
        self.assertEqual(self.count(self.RegistrationDraft), 0)
        self.assertEqual(self.count(self.Registration), 1)

    def test_a_submitted_draft_goes_back_to_an_incomplete_registration(self):
        lodging = self.Lodging.objects.create(event=self.event, name='Cabin')
        draft = self.RegistrationDraft.objects.create(
            event=self.event, registrant_email='pat@example.com',
            form_data={
                'billing_name': 'Pat', 'registrant_email': 'pat@example.com',
                'campers': [{'name': 'Pat', 'lodging': {
                    'lodging_requested': {'id': lodging.id}, 'lodging_shared': True,
                    'lodging_shared_with': 'Lee', 'lodging_comments': 'Lake'}}],
            },
            server_pricing_results={'total': 5, 'campers': [{'total': 5}]},
            client_reported_pricing={'total': 5},
            submitted_at=timezone.now() - datetime.timedelta(days=2))
        self.reverse()

        registration = self.Registration.objects.get(uuid=draft.uuid)
        self.assertFalse(registration.completed)
        self.assertEqual(registration.attributes, {'billing_name': 'Pat'})
        self.assertEqual(registration.created_at, draft.submitted_at)
        self.assertEqual(registration.server_pricing_results['total'], 5)
        camper = self.Camper.objects.get(registration=registration)
        self.assertEqual(camper.attributes, {'name': 'Pat'})
        self.assertEqual(camper.lodging_requested_id, lodging.id)
        self.assertEqual(camper.lodging_id, lodging.id)
        self.assertTrue(camper.lodging_shared)
        self.assertEqual(camper.lodging_comments, 'Lake')
        self.assertEqual(camper.server_pricing_results, {'total': 5})

    def test_who_a_camper_would_have_shared_with_is_left_out_once_unticked(self):
        lodging = self.Lodging.objects.create(event=self.event, name='Cabin')
        self.RegistrationDraft.objects.create(
            event=self.event, form_data={'campers': [{'name': 'Pat', 'lodging': {
                'lodging_requested': {'id': lodging.id}, 'lodging_shared': False,
                'lodging_shared_with': 'x' * 300}}]},
            submitted_at=timezone.now())
        self.reverse()
        self.assertEqual(self.Camper.objects.get().lodging_shared_with, '')

    def test_one_still_being_filled_in_had_no_registration_to_go_back_to(self):
        self.RegistrationDraft.objects.create(event=self.event, form_data={'campers': [{}]})
        self.reverse()
        self.assertEqual(self.count(self.Registration), 0)


class RemovingCompletedTests(MigrationTestCase):
    '''0090 settles what 0089 left incomplete.'''

    def settle(self):
        migration(REMOVING).settle_incomplete_registrations(self.apps)

    def invoiced(self, **fields):
        registration = self.registration(**fields)
        self.Invoice.objects.create(registration=registration, origin='admin', amount=Decimal('5'))
        return registration

    def test_one_with_an_invoice_or_payment_is_completed_and_sends_no_email(self):
        invoiced = self.invoiced()
        self.settle()
        invoiced.refresh_from_db()
        self.assertTrue(invoiced.completed)
        self.assertIsNotNone(invoiced.completed_at)
        # The worker emails anyone completed that this isn't set for.
        self.assertIsNotNone(invoiced.confirmation_sent_at)

    def test_one_already_confirmed_keeps_when_it_was(self):
        when = timezone.now() - datetime.timedelta(days=40)
        invoiced = self.invoiced(confirmation_sent_at=when, completed_at=when)
        self.settle()
        invoiced.refresh_from_db()
        self.assertEqual((invoiced.confirmation_sent_at, invoiced.completed_at), (when, when))

    def test_one_with_money_stays_even_if_deleted(self):
        deleted = self.invoiced(deleted_at=timezone.now())
        self.settle()
        deleted.refresh_from_db()
        self.assertTrue(deleted.completed)
        self.assertIsNotNone(deleted.deleted_at)

    def test_the_rest_go_with_their_campers(self):
        charged = self.registration()
        charge_type = self.CustomChargeType.objects.create(event=self.event, name='linens')
        self.CustomCharge.objects.create(
            custom_charge_type=charge_type, camper=self.camper(charged), amount=Decimal('1.00'))
        self.registration(deleted_at=timezone.now())
        self.settle()
        self.assertEqual(self.count(self.Registration), 0)
        self.assertEqual(self.count(self.Camper), 0)

    def test_a_completed_one_is_left_alone(self):
        completed = self.registration(completed=True)
        self.settle()
        completed.refresh_from_db()
        self.assertIsNone(completed.confirmation_sent_at)

    def test_the_whole_migration_can_delete_rows_and_alter_the_table(self):
        # Rows deleted beside the ALTER TABLE: Postgres refuses it if their foreign
        # key checks are still pending, which a database with nothing to delete hides.
        self.camper(self.registration())
        kept = self.invoiced()
        try:
            apps = migrate_to(REMOVING)
            Registration = apps.get_model('camphoric', 'Registration')
            self.assertEqual([r.id for r in Registration._base_manager.all()], [kept.id])
        finally:
            type(self).apps = migrate_to(BEFORE_REMOVING)

    def test_going_back_every_registration_is_completed(self):
        self.registration(completed=True)
        migrate_to(REMOVING)
        apps = migrate_to(BEFORE_REMOVING)
        registration = apps.get_model('camphoric', 'Registration')._base_manager.get()
        self.assertTrue(registration.completed)


class ContractSectionsIntoBodyTests(TransactionTestCase):
    '''A version's sections become one Markdown document, its headings (DR-153).'''

    # Each test starts before the change and ends at the latest migration, where the
    # test case's clean-up expects the tables to be.
    def setUp(self):
        self.apps = migrate_to('0092_connected_apps')

    def tearDown(self):
        migrate_to_latest()

    def test_sections_become_headings_in_order(self):
        Organization = self.apps.get_model('camphoric', 'Organization')
        Contract = self.apps.get_model('camphoric', 'Contract')
        Section = self.apps.get_model('camphoric', 'ContractSection')
        draft = Contract.objects.create(organization=Organization.objects.create(name='Org'))
        for order, (title, body) in enumerate([
                ('Privacy Policy', 'We keep it safe.\n'), (' Waiver ', ''), ('Rules', 'Be kind.')]):
            Section.objects.create(contract=draft, order=order, title=title, body=body,
                                   kind='privacy_policy' if order == 0 else 'custom')

        apps = migrate_to('0093_contract_body')
        draft = apps.get_model('camphoric', 'Contract').objects.get(pk=draft.pk)
        self.assertEqual(draft.body, '## Privacy Policy\n\nWe keep it safe.\n\n## Waiver\n\n'
                                     '## Rules\n\nBe kind.')

    def test_a_published_version_keeps_its_hash(self):
        Organization = self.apps.get_model('camphoric', 'Organization')
        Contract = self.apps.get_model('camphoric', 'Contract')
        Section = self.apps.get_model('camphoric', 'ContractSection')
        published = Contract.objects.create(
            organization=Organization.objects.create(name='Org'), number=1,
            published_at=timezone.now(), content_sha256='a' * 64)
        Section.objects.create(contract=published, order=0, kind='privacy_policy',
                               title='Privacy Policy', body='Kept safe.')

        apps = migrate_to('0093_contract_body')
        published = apps.get_model('camphoric', 'Contract').objects.get(pk=published.pk)
        self.assertEqual(published.content_sha256, 'a' * 64)

    def test_going_back_keeps_the_text_as_one_privacy_policy(self):
        apps = migrate_to('0093_contract_body')
        Organization = apps.get_model('camphoric', 'Organization')
        Contract = apps.get_model('camphoric', 'Contract')
        draft = Contract.objects.create(organization=Organization.objects.create(name='Org'),
                                        body='## Privacy\n\nKept safe.')

        apps = migrate_to('0092_connected_apps')
        sections = list(apps.get_model('camphoric', 'ContractSection').objects.filter(
            contract_id=draft.pk).values('order', 'kind', 'title', 'body'))
        self.assertEqual(sections, [{'order': 0, 'kind': 'privacy_policy',
                                     'title': 'Privacy Policy',
                                     'body': '## Privacy\n\nKept safe.'}])

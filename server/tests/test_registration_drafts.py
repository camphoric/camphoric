'''
Registration drafts (SPEC DR-140): the form saved as it's filled in, and what a
registration is until it's completed.
'''

import copy
import datetime
import json
import shutil
import subprocess
from unittest import mock, skipUnless
import uuid

from auditlog.models import LogEntry
from dbbackup.db.base import get_connector
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import TransactionTestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from freezegun import freeze_time
from rest_framework.test import APITestCase

from camphoric import invoices, live, models, roles, views
from camphoric.templating.graph import build_event_graph
from tests.factories import complete, make_user, quote
from tests.test_views import create_standard_test_event


class DraftTestCase(APITestCase):
    def setUp(self):
        cache.clear()  # the throttles' counts
        create_standard_test_event(self)
        self.url = f'/api/events/{self.event.id}/register'

    def tearDown(self):
        cache.clear()

    def save(self, form_data=None, status=200, **body):
        response = self.client.post(
            f'{self.url}/draft',
            {'formData': {'campers': [{}]} if form_data is None else form_data, **body},
            format='json')
        self.assertEqual(response.status_code, status, getattr(response, 'data', None))
        return response

    def submit(self, **body):
        response = self.client.post(
            self.url, {'formData': self.valid_form_data, 'pricingResults': {}, **body},
            format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return response


class SavingTests(DraftTestCase):
    def test_a_save_stores_what_was_entered_and_returns_only_the_uuid(self):
        data = {'registrant_email': 'pat@', 'campers': [{'name': 'Pat'}]}
        response = self.save(data)
        draft = models.RegistrationDraft.objects.get()
        self.assertEqual(response.data, {'uuid': draft.uuid})
        self.assertEqual(draft.form_data, data)
        self.assertEqual(draft.registrant_email, 'pat@')
        self.assertIsNone(draft.submitted_at)

    def test_opening_the_page_makes_nothing(self):
        self.assertEqual(self.client.get(self.url).status_code, 200)
        self.assertFalse(models.RegistrationDraft.objects.exists())

    def test_a_later_save_updates_the_draft_and_its_activity(self):
        with freeze_time('2026-06-01 10:00:00'):
            draft_uuid = self.save().data['uuid']
        with freeze_time('2026-06-01 10:05:00'):
            self.assertEqual(
                self.save({'registrant_email': 'new@example.com'}, uuid=str(draft_uuid)).data,
                {'uuid': draft_uuid})
        draft = models.RegistrationDraft.objects.get()
        self.assertEqual(draft.registrant_email, 'new@example.com')
        self.assertEqual(draft.last_activity_at.minute, 5)
        self.assertEqual(draft.created_at.minute, 0)

    def test_a_new_draft_takes_the_uuid_the_browser_chose(self):
        # So a first save whose answer is lost as the page closes still names it (#953).
        chosen = uuid.uuid4()
        self.assertEqual(self.save(uuid=str(chosen)).data['uuid'], chosen)
        self.assertEqual(models.RegistrationDraft.objects.get().uuid, chosen)
        self.save({'registrant_email': 'pat@example.com'}, uuid=str(chosen))
        self.assertEqual(models.RegistrationDraft.objects.get().registrant_email, 'pat@example.com')

    def test_a_uuid_only_this_events_draft_has_is_left_to_collide(self):
        # One started since the caller looked: saving it then fails, and the caller takes that.
        chosen = uuid.uuid4()
        models.RegistrationDraft.objects.create(event=self.event, uuid=chosen)
        self.assertEqual(views.new_draft(self.event, chosen).uuid, chosen)

    def test_a_save_without_a_uuid_starts_a_draft_under_a_new_one(self):
        for sent in ({}, {'uuid': 'not a uuid'}):
            with self.subTest(sent=sent):
                self.assertIsInstance(self.save(**sent).data['uuid'], uuid.UUID)
        self.assertEqual(models.RegistrationDraft.objects.count(), 2)

    def test_a_save_starting_the_draft_another_request_just_started_leaves_it(self):
        chosen = uuid.uuid4()

        def started_meanwhile(event, wanted):
            models.RegistrationDraft.objects.create(event=event, uuid=wanted, form_data={'a': 1})
            return models.RegistrationDraft(event=event, uuid=wanted)

        with mock.patch('camphoric.views.new_draft', side_effect=started_meanwhile):
            self.assertEqual(self.save({'b': 2}, uuid=str(chosen)).data['uuid'], chosen)
        self.assertEqual(models.RegistrationDraft.objects.get().form_data, {'a': 1})

    def test_a_uuid_from_another_event_starts_a_new_draft(self):
        other = models.RegistrationDraft.objects.create(event=models.Event.objects.create(
            organization=self.event.organization, name='Other'))
        self.assertNotEqual(self.save(uuid=str(other.uuid)).data['uuid'], other.uuid)
        other.refresh_from_db()
        self.assertEqual(other.form_data, {})

    def test_no_form_is_refused(self):
        self.client.post(f'{self.url}/draft', {'formData': 'text'}, format='json')
        self.assertFalse(models.RegistrationDraft.objects.exists())

    def test_an_oversized_form_is_refused(self):
        self.save({'comments': 'x' * (60 * 1024)}, status=400)
        self.assertFalse(models.RegistrationDraft.objects.exists())

    def test_what_the_database_cant_store_is_refused_not_a_server_error(self):
        self.save({'comments': 'x\u0000y'}, status=400)
        self.save({'registrant_email': '\u0000'}, status=400)
        # Half of a character: json.dumps escapes it, as a browser's JSON can hold it.
        for field in ('comments', 'registrant_email'):
            response = self.client.post(
                f'{self.url}/draft', f'{{"formData": {{"{field}": "\\ud83d"}}}}',
                content_type='application/json')
            self.assertEqual(response.status_code, 400)
        response = self.client.post(f'{self.url}/draft', ['a list'], format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(models.RegistrationDraft.objects.exists())

    def test_sending_what_the_database_cant_store_is_refused_not_a_server_error(self):
        for value in ('x\\u0000y', '\\ud83d'):
            for body in (f'{{"formData": {{"comments": "{value}"}}, "pricingResults": {{}}}}',
                         f'{{"formData": {{}}, "pricingResults": {{}}, "promoCode": "{value}"}}'):
                with self.subTest(body=body):
                    response = self.client.post(self.url, body, content_type='application/json')
                    self.assertEqual(response.status_code, 400)
        self.assertFalse(models.RegistrationDraft.objects.exists())

    def test_a_number_too_large_for_json_is_refused_not_a_server_error(self):
        sent = json.dumps({'formData': self.valid_form_data, 'pricingResults': {}})
        for path, body in ((f'{self.url}/draft', '{"formData": {"age": 1e400}}'),
                           (self.url, sent.replace('"pricingResults": {}',
                                                   '"pricingResults": {"x": 1e400}'))):
            with self.subTest(path=path):
                response = self.client.post(path, body, content_type='application/json')
                self.assertEqual(response.status_code, 400)
        self.assertFalse(models.RegistrationDraft.objects.exists())

    def test_an_invitation_the_database_cant_look_up_is_refused_not_a_server_error(self):
        response = self.client.post(
            f'{self.url}/draft',
            '{"formData": {}, "invitation": '
            '{"recipient_email": "a\\u0000", "invitation_code": "b"}}',
            content_type='application/json')
        self.assertEqual(response.status_code, 400)

    def test_a_nul_in_what_is_looked_up_is_refused_not_a_server_error(self):
        address = '?email=a%00&code=b'
        promo = f'/api/events/{self.event.id}/checkpromo'
        for sent in (self.client.get(self.url + address),
                     self.client.post(self.url + address, {
                         'formData': self.valid_form_data, 'pricingResults': {}}, format='json'),
                     self.client.post(promo + address, {'code': 'x'}, format='json'),
                     self.client.post(promo, {'code': 'a\x00'}, format='json')):
            self.assertIn(sent.status_code, (200, 400, 403, 404, 409), sent.data)
        self.assertFalse(models.RegistrationDraft.objects.exists())

    def test_an_answer_only_spelling_out_a_nul_is_kept(self):
        data = {'comments': 'C:\\u0000 \\\\u0000'}
        self.save(data)
        self.assertEqual(models.RegistrationDraft.objects.get().form_data, data)

    def test_a_file_where_the_form_should_be_is_refused(self):
        upload = SimpleUploadedFile('form.txt', b'not a form')
        response = self.client.post(
            self.url, {'formData': upload, 'pricingResults': 'x'}, format='multipart')
        self.assertEqual(response.status_code, 400, response.data)

    def test_sending_an_email_too_long_to_store_is_refused(self):
        email = 'x' * 260 + '@example.com'
        response = self.client.post(
            self.url, {'formData': {**self.valid_form_data, 'registrant_email': email},
                       'pricingResults': {}}, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('registrant_email', response.data)

    def test_a_long_or_odd_email_doesnt_fail_the_save(self):
        self.save({'registrant_email': 'x' * 300})
        self.save({'registrant_email': {'not': 'text'}})
        self.assertEqual(
            sorted(len(d.registrant_email) for d in models.RegistrationDraft.objects.all()),
            [0, 254])

    def test_a_closed_event_takes_none(self):
        self.event.registration_end = timezone.now() - datetime.timedelta(days=1)
        self.event.save()
        self.save(status=409)
        self.assertFalse(models.RegistrationDraft.objects.exists())

    def test_it_has_its_own_throttle(self):
        with mock.patch('rest_framework.throttling.ScopedRateThrottle.THROTTLE_RATES',
                        {'registration_draft': '2/minute', 'register': '100/minute'}):
            self.save()
            self.save()
            self.save(status=429)
            self.assertEqual(self.submit().status_code, 200)

    def test_it_isnt_audited(self):
        before = LogEntry.objects.count()
        self.save()
        self.assertEqual(LogEntry.objects.count(), before)


@override_settings(CAMPHORIC_MAX_OPEN_DRAFTS=2)
class TooManyDraftsTests(DraftTestCase):
    '''An event holds only so many drafts nobody has sent (DR-144).'''

    def test_a_save_that_would_start_another_waits(self):
        first = self.save().data['uuid']
        self.save()
        response = self.save(status=429)
        self.assertEqual(response['Retry-After'], '600')
        self.assertEqual(models.RegistrationDraft.objects.count(), 2)
        # The drafts it holds go on saving.
        self.save({'registrant_email': 'pat@example.com'}, uuid=str(first))
        self.assertTrue(models.RegistrationDraft.objects.filter(
            registrant_email='pat@example.com').exists())

    def test_sending_the_form_goes_on_and_frees_a_place(self):
        draft = self.save().data['uuid']
        self.save()
        self.submit(draftUUID=str(draft))
        self.submit()
        self.save()
        self.assertEqual(models.RegistrationDraft.objects.filter(
            submitted_at__isnull=True).count(), 2)

    def test_reopening_a_sent_draft_counts_as_starting_one(self):
        sent = self.submit().data['registrationUUID']
        self.save()
        self.save()
        changed = {**self.valid_form_data, 'billing_name': 'Changed'}
        self.save(changed, uuid=str(sent), reopen=True, status=429)
        self.assertIsNotNone(models.RegistrationDraft.objects.get(uuid=sent).submitted_at)

    def test_another_events_drafts_dont_count(self):
        other = models.Event.objects.create(organization=self.event.organization, name='Other')
        models.RegistrationDraft.objects.bulk_create(
            [models.RegistrationDraft(event=other) for _ in range(2)])
        self.save()


class LateSaveTests(DraftTestCase):
    def test_a_save_landing_after_the_form_was_sent_changes_nothing(self):
        # It left before the form did, but took longer (#952).
        draft_uuid = self.submit().data['registrationUUID']
        self.save({'campers': [{}]}, uuid=str(draft_uuid))
        draft = models.RegistrationDraft.objects.get()
        self.assertIsNotNone(draft.submitted_at)
        self.assertEqual(draft.form_data, self.valid_form_data)
        self.assertEqual(complete(self.client, self.event, draft_uuid).status_code, 200)

    def test_a_save_landing_after_completion_makes_no_ghost_draft(self):
        draft_uuid = self.submit().data['registrationUUID']
        complete(self.client, self.event, draft_uuid)
        self.assertEqual(self.save(uuid=str(draft_uuid)).data['uuid'], draft_uuid)
        self.assertFalse(models.RegistrationDraft.objects.exists())

    def test_a_uuid_of_another_events_registration_still_starts_a_draft(self):
        other = models.Event.objects.create(organization=self.event.organization, name='Other')
        registration = models.Registration.objects.create(
            event=other, registrant_email='pat@example.com')
        self.assertNotEqual(self.save(uuid=str(registration.uuid)).data['uuid'], registration.uuid)
        self.assertEqual(models.RegistrationDraft.objects.count(), 1)


class ActivityNoticeTests(DraftTestCase):
    def notices(self, *args, **kwargs):
        with mock.patch.object(live, 'notify') as notify:
            self.save(*args, **kwargs)
        return [call.args[0]['action'] for call in notify.call_args_list]

    def test_only_a_new_or_returning_draft_sends_a_notice(self):
        with freeze_time('2026-06-01 10:00:00'):
            self.assertEqual(self.notices(), ['created'])
            draft = models.RegistrationDraft.objects.get()
        with freeze_time('2026-06-01 10:01:00'):
            self.assertEqual(self.notices(uuid=str(draft.uuid)), [])
        with freeze_time('2026-06-01 10:03:01'):
            self.assertEqual(self.notices(uuid=str(draft.uuid)), ['updated'])


class SubmittingTests(DraftTestCase):
    def test_it_submits_the_draft_being_saved_under_the_same_uuid(self):
        draft_uuid = self.save().data['uuid']
        response = self.submit(draftUUID=str(draft_uuid))
        self.assertEqual(response.data['registrationUUID'], draft_uuid)
        draft = models.RegistrationDraft.objects.get()
        self.assertIsNotNone(draft.submitted_at)
        self.assertEqual(draft.registrant_email, self.valid_form_data['registrant_email'])
        self.assertEqual(draft.server_pricing_results, response.data['serverPricingResults'])

    def test_it_makes_no_registration_campers_or_entries(self):
        before = LogEntry.objects.count()
        self.submit()
        self.assertFalse(models.Registration.all_objects.exists())
        self.assertFalse(models.Camper.all_objects.exists())
        self.assertEqual(LogEntry.objects.count(), before)

    def test_without_a_draft_it_makes_one(self):
        self.assertEqual(self.submit().data['registrationUUID'],
                         models.RegistrationDraft.objects.get().uuid)

    def test_sending_it_again_updates_the_same_draft(self):
        first = self.submit().data['registrationUUID']
        again = self.submit(draftUUID=str(first)).data['registrationUUID']
        self.assertEqual(again, first)
        self.assertEqual(models.RegistrationDraft.objects.count(), 1)

    def test_it_keeps_the_form_as_sent(self):
        self.submit()
        self.assertEqual(models.RegistrationDraft.objects.get().form_data, self.valid_form_data)

    def test_the_payment_step_reads_the_draft_and_counts_as_activity(self):
        with freeze_time('2026-06-01 10:00:00'):
            sent = self.submit().data
        with freeze_time('2026-06-01 10:30:00'):
            response = self.client.post(self.url, {
                'step': 'payment-step', 'registrationUUID': str(sent['registrationUUID']),
            }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['serverPricingResults'], sent['serverPricingResults'])
        self.assertEqual(response.data['paymentOptions'], sent['paymentOptions'])
        self.assertIs(response.data['invoiceCancelled'], False)
        self.assertIs(response.data['paymentProcessing'], False)
        self.assertEqual(models.RegistrationDraft.objects.get().last_activity_at.minute, 30)

    def test_a_save_of_the_same_answers_leaves_it_submitted(self):
        # The blur from clicking the button can arrive just after the button's own post.
        draft_uuid = self.submit().data['registrationUUID']
        self.save(copy.deepcopy(self.valid_form_data), uuid=str(draft_uuid))
        self.assertIsNotNone(models.RegistrationDraft.objects.get().submitted_at)

    def test_another_tab_changing_the_answers_leaves_what_was_sent(self):
        draft_uuid = self.submit().data['registrationUUID']
        self.save({**self.valid_form_data, 'billing_name': 'Changed'}, uuid=str(draft_uuid))
        draft = models.RegistrationDraft.objects.get()
        self.assertIsNotNone(draft.submitted_at)
        self.assertEqual(draft.form_data, self.valid_form_data)
        response = complete(self.client, self.event, draft_uuid)
        self.assertEqual(response.status_code, 200, response.data)

    def test_a_browser_sent_back_to_the_form_reopens_it_by_changing_the_answers(self):
        # Its lodging filled up before it was completed (DR-142).
        draft_uuid = self.submit().data['registrationUUID']
        self.save(copy.deepcopy(self.valid_form_data), uuid=str(draft_uuid), reopen=True)
        self.assertIsNotNone(models.RegistrationDraft.objects.get().submitted_at)

        changed = {**self.valid_form_data, 'billing_name': 'Changed'}
        self.save(changed, uuid=str(draft_uuid), reopen=True)
        draft = models.RegistrationDraft.objects.get()
        self.assertIsNone(draft.submitted_at)
        self.assertIsNone(draft.server_pricing_results)
        self.assertEqual(draft.form_data, changed)

    def test_sending_the_form_again_replaces_what_was_sent(self):
        draft_uuid = self.submit().data['registrationUUID']
        changed = {**self.valid_form_data, 'billing_name': 'Changed'}
        self.submit(formData=changed, draftUUID=str(draft_uuid))
        self.assertEqual(models.RegistrationDraft.objects.get().form_data, changed)

    def test_it_submits_a_draft_under_the_uuid_the_browser_chose(self):
        # The first save, under that uuid, may not have got there yet (#953).
        chosen = uuid.uuid4()
        self.assertEqual(self.submit(draftUUID=str(chosen)).data['registrationUUID'], chosen)
        self.save({'campers': [{}]}, uuid=str(chosen))
        draft = models.RegistrationDraft.objects.get()
        self.assertIsNotNone(draft.submitted_at)
        self.assertEqual(draft.form_data, self.valid_form_data)

    def test_it_sends_a_draft_a_save_started_as_it_went(self):
        chosen = uuid.uuid4()

        def started_meanwhile(event, wanted):
            models.RegistrationDraft.objects.create(event=event, uuid=wanted, form_data={'a': 1})
            return models.RegistrationDraft(event=event, uuid=wanted)

        with mock.patch('camphoric.views.new_draft', side_effect=started_meanwhile):
            response = self.submit(draftUUID=str(chosen))
        self.assertEqual(response.data['registrationUUID'], chosen)
        draft = models.RegistrationDraft.objects.get()
        self.assertIsNotNone(draft.submitted_at)
        self.assertEqual(draft.form_data, self.valid_form_data)


class CompletingTests(DraftTestCase):
    def test_it_makes_the_registration_and_campers_under_the_same_uuid(self):
        draft_uuid = self.submit().data['registrationUUID']
        self.assertEqual(complete(self.client, self.event, draft_uuid).status_code, 200)

        registration = models.Registration.objects.get(uuid=draft_uuid)
        self.assertIsNotNone(registration.completed_at)
        self.assertEqual(registration.registrant_email, self.valid_form_data['registrant_email'])
        self.assertEqual(registration.campers.count(), len(self.valid_form_data['campers']))
        self.assertEqual([c.sequence for c in registration.campers.all()],
                         list(range(len(self.valid_form_data['campers']))))
        self.assertFalse(models.RegistrationDraft.objects.exists())

    def test_the_history_starts_with_the_whole_record(self):
        draft_uuid = self.submit().data['registrationUUID']
        complete(self.client, self.event, draft_uuid)
        registration = models.Registration.objects.get(uuid=draft_uuid)
        created = LogEntry.objects.get_for_object(registration).get(action=LogEntry.Action.CREATE)
        self.assertIn('registrant_email', created.changes)
        self.assertEqual(
            LogEntry.objects.filter(
                additional_data__registration=registration.id,
                content_type__model='camper', action=LogEntry.Action.CREATE).count(),
            registration.campers.count())

    def test_it_stays_dated_when_it_was_submitted(self):
        # Early-bird pricing goes by this: paying a day later mustn't lose it.
        with freeze_time('2026-06-01 10:00:00'):
            draft_uuid = self.submit().data['registrationUUID']
        with freeze_time('2026-06-02 10:00:00'):
            complete(self.client, self.event, draft_uuid)
        registration = models.Registration.objects.get(uuid=draft_uuid)
        self.assertEqual(registration.created_at.day, 1)
        self.assertEqual(registration.completed_at.day, 2)

    def test_a_second_payment_is_answered_as_the_first(self):
        draft_uuid = self.submit().data['registrationUUID']
        complete(self.client, self.event, draft_uuid)
        self.assertEqual(complete(self.client, self.event, draft_uuid).status_code, 200)
        self.assertEqual(models.Registration.objects.count(), 1)

    def test_finishing_or_capturing_a_draft_is_refused_and_keeps_it(self):
        draft_uuid = str(self.submit().data['registrationUUID'])
        for data in ({'step': 'finish'},
                     {'step': 'payment', 'paymentType': 'PayPal', 'paypalOrderId': 'ORDER'}):
            with self.subTest(step=data['step']):
                self.event.paypal_client_id = 'client'
                self.event.save()
                response = self.client.post(
                    self.url, {'registrationUUID': draft_uuid, **data}, format='json')
                self.assertEqual(response.status_code, 409, response.data)
        self.assertTrue(models.RegistrationDraft.objects.exists())

    def test_one_still_being_filled_in_cant_be_paid_for(self):
        draft_uuid = self.save().data['uuid']
        self.assertEqual(complete(self.client, self.event, draft_uuid).status_code, 404)

    def test_an_unusable_payment_type_leaves_the_draft(self):
        draft_uuid = str(self.submit().data['registrationUUID'])
        response = self.client.post(self.url, {
            'step': 'payment', 'registrationUUID': draft_uuid, 'paymentType': 'Bitcoin',
            'quote': quote(self.client, self.event, draft_uuid),
        }, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertTrue(models.RegistrationDraft.objects.exists())
        self.assertFalse(models.Registration.all_objects.exists())


class PriceChangedTests(DraftTestCase):
    '''What a page shows is what's charged: a new price is shown before it's paid (DR-140).'''

    def setUp(self):
        super().setUp()
        self.sent = self.submit().data
        self.total = self.sent['serverPricingResults']['total']

    def raise_the_price(self):
        cabins, *rest = self.event.registration_pricing_logic
        self.event.registration_pricing_logic = [{**cabins, 'exp': {'*': [2, 100]}}, *rest]
        self.event.save()

    def pay(self, quote=None, **data):
        return self.client.post(self.url, {
            'registrationUUID': str(self.sent['registrationUUID']),
            'quote': quote or self.sent['quote'], **data}, format='json')

    def check(self, quote=None):
        return self.pay(quote, step='payment', paymentType='Check',
                        paymentOption=self.sent['paymentOptions']['default'] or 'Full Payment')

    def assertRefusedWithTheNewPrice(self, response):
        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(response.data['code'], 'invoice_changed')
        step = response.data['paymentStep']
        self.assertGreater(step['serverPricingResults']['total'], self.total)
        self.assertEqual(step['registrationUUID'], self.sent['registrationUUID'])
        self.assertFalse(models.Registration.all_objects.exists())

    def test_a_page_showing_the_price_can_pay(self):
        self.assertEqual(self.check().status_code, 200)

    def test_a_check_is_refused_and_shown_the_new_price(self):
        self.raise_the_price()
        self.assertRefusedWithTheNewPrice(self.check())

    def test_the_paypal_button_is_too(self):
        self.raise_the_price()
        self.event.paypal_client_id = 'client'
        self.event.save()
        self.assertRefusedWithTheNewPrice(self.pay(step='paypal-order', paymentType='PayPal'))

    def importer_pays(self):
        # As the event importer and bulk tool do, published versions included.
        return self.client.post(self.url, {
            'step': 'payment', 'paymentType': 'Check',
            'registrationUUID': str(self.sent['registrationUUID'])}, format='json')

    def test_without_a_quote_it_pays_the_price_the_draft_holds(self):
        self.assertEqual(self.importer_pays().status_code, 200)

    def test_without_a_quote_a_new_price_is_refused_once_and_then_paid(self):
        # A page loaded before there were quotes shows the new price, and takes it.
        self.raise_the_price()
        self.assertRefusedWithTheNewPrice(self.importer_pays())
        self.assertEqual(self.importer_pays().status_code, 200)

    def test_a_line_that_moves_without_changing_what_is_asked_refuses_nothing(self):
        self.event.registration_pricing_logic = [
            *self.event.registration_pricing_logic,
            {'var': 'stamp', 'exp': {'var': 'date.epoch'}}]
        self.event.save()
        with freeze_time('2026-06-01 10:00:00'):
            self.sent = self.submit().data
        with freeze_time('2026-06-01 10:00:05'):
            self.assertEqual(self.check().status_code, 200)

    def test_a_page_given_the_new_price_can_pay_it(self):
        self.raise_the_price()
        step = self.check().data['paymentStep']
        new_total = step['serverPricingResults']['total']
        draft = models.RegistrationDraft.objects.get()
        self.assertEqual(draft.server_pricing_results['total'], new_total)
        self.assertEqual(self.check(step['quote']).status_code, 200)
        self.assertEqual(models.Registration.objects.get().server_pricing_results['total'],
                         new_total)

    def test_a_second_tab_showing_the_old_price_is_refused_after_the_first_was(self):
        self.raise_the_price()
        self.check()
        self.assertRefusedWithTheNewPrice(self.check())

    def test_a_tab_left_on_the_old_price_is_refused_once_the_registration_is_completed(self):
        self.raise_the_price()
        now = self.pay(step='payment-step').data
        self.assertEqual(self.check(now['quote']).status_code, 200)
        invoice = models.Invoice.objects.get()

        response = self.check()

        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(response.data['code'], 'invoice_changed')
        self.assertEqual(response.data['invoice']['id'], invoice.id)
        step = response.data['paymentStep']
        self.assertEqual(step['quote'], now['quote'])
        self.assertEqual(self.check(step['quote']).status_code, 200)

    def test_a_deposit_changed_under_the_same_total_is_refused(self):
        deposit = {'title': 'Payment', 'enum': [
            json.dumps({'name': 'Deposit', 'logic': {'*': [{'var': 'total'}, 0.25]}})]}
        self.event.registration_deposit_schema = deposit
        self.event.save()
        self.sent = self.submit().data
        deposit['enum'] = [
            json.dumps({'name': 'Deposit', 'logic': {'*': [{'var': 'total'}, 0.75]}})]
        self.event.registration_deposit_schema = deposit
        self.event.save()
        response = self.pay(step='payment', paymentType='Check', paymentOption='Deposit')
        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(response.data['code'], 'invoice_changed')
        option = response.data['paymentStep']['paymentOptions']['options'][0]
        self.assertEqual(option['amount'], self.total * 0.75)
        self.assertFalse(models.Invoice.objects.exists())

    def test_a_handling_fee_changed_is_refused(self):
        self.event.epayment_handling = 5
        self.event.paypal_client_id = 'client'
        self.event.save()
        self.assertEqual(self.check().data['code'], 'invoice_changed')

    def test_a_reopened_page_shows_what_is_due_now(self):
        self.raise_the_price()
        step = self.client.post(self.url, {
            'step': 'payment-step', 'registrationUUID': str(self.sent['registrationUUID']),
        }, format='json').data
        self.assertGreater(step['serverPricingResults']['total'], self.total)
        self.assertNotEqual(step['quote'], self.sent['quote'])
        self.assertEqual(self.check(step['quote']).status_code, 200)

    def test_a_reopened_page_with_its_lodging_gone_still_opens(self):
        draft = models.RegistrationDraft.objects.get()
        with mock.patch('camphoric.views.pricing.calculate_price',
                        side_effect=models.Lodging.DoesNotExist):
            response = self.client.post(self.url, {
                'step': 'payment-step', 'registrationUUID': str(draft.uuid)}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['serverPricingResults']['total'], self.total)


class AlreadyPaidTests(DraftTestCase):
    '''A paid invoice stands, and the page is told so.'''

    def setUp(self):
        super().setUp()
        self.event.paypal_enabled = True
        self.event.paypal_client_id = 'client'
        full = json.dumps({'name': 'Full', 'logic': {'var': 'total'}})
        deposit = json.dumps({'name': 'Deposit', 'logic': 50})
        self.event.registration_deposit_schema = {
            'title': 'How much?', 'default': full,
            'enum': [full, deposit], 'enumNames': ['Full', 'Deposit']}
        self.event.save()
        self.sent = self.submit().data

    def order(self, option, **body):
        with mock.patch('camphoric.invoices.create_paypal_order', return_value='ORDER') as made:
            response = self.client.post(self.url, {
                'step': 'paypal-order', 'registrationUUID': str(self.sent['registrationUUID']),
                'paymentType': 'PayPal', 'paymentOption': option, **body}, format='json')
        return response, made

    def paid_in_full(self):
        self.order('Full', quote=self.sent['quote'])
        registration = models.Registration.objects.get()
        invoice = invoices.registration_invoice(registration)
        models.Payment.objects.create(
            registration=registration, invoice=invoice,
            payment_type=models.PaymentType.PAYPAL, amount=invoice.amount)
        return invoice

    def assertAlreadyPaid(self, response):
        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(response.data['detail'], 'This registration has already been paid.')

    def test_a_page_on_an_old_quote_is_told_its_paid_not_that_it_changed(self):
        self.paid_in_full()
        self.assertAlreadyPaid(self.order('Deposit', quote='an old page')[0])

    def test_an_organizers_invoice_with_nothing_left_due_is_told_its_paid(self):
        invoice = self.paid_in_full()
        models.Invoice.objects.filter(pk=invoice.pk).update(organizer_changed_at=timezone.now())
        step = self.client.post(self.url, {
            'step': 'payment-step', 'registrationUUID': str(self.sent['registrationUUID']),
        }, format='json').data
        [option] = step['paymentOptions']['options']
        self.assertEqual(option['amount'], 0)
        self.assertAlreadyPaid(self.order(option['name'], quote=step['quote'])[0])

    def test_a_capture_finishing_before_the_order_is_made_stands_and_no_order_is_made(self):
        first, _ = self.order('Full', quote=self.sent['quote'])
        self.assertEqual(first.status_code, 200, first.data)
        registration = models.Registration.objects.get()
        invoice = invoices.registration_invoice(registration)
        paid, description = invoice.amount, invoice.description
        locked = views.RegisterView.locked_registration.__func__
        calls = []

        def capture_lands(cls, request, event):
            calls.append(request)
            if len(calls) == 2:
                models.Payment.objects.create(
                    registration=registration, invoice=invoice,
                    payment_type=models.PaymentType.PAYPAL, amount=paid)
            return locked(cls, request, event)

        with mock.patch.object(
                views.RegisterView, 'locked_registration', classmethod(capture_lands)):
            second, made = self.order('Deposit')

        self.assertEqual(second.status_code, 409, second.data)
        made.assert_not_called()
        invoice.refresh_from_db()
        self.assertEqual((invoice.amount, invoice.description), (paid, description))


class PriceFellToNothingTests(DraftTestCase):
    def test_finishing_rewrites_an_invoice_left_from_a_cancelled_paypal_try(self):
        self.event.paypal_enabled = True
        self.event.paypal_client_id = 'client'
        self.event.save()
        sent = self.submit().data
        with mock.patch('camphoric.invoices.create_paypal_order', return_value='ORDER'):
            self.client.post(self.url, {
                'step': 'paypal-order', 'registrationUUID': str(sent['registrationUUID']),
                'paymentType': 'PayPal', 'paymentOption': sent['paymentOptions']['default'],
                'quote': sent['quote']}, format='json')
        registration = models.Registration.objects.get()
        registration.server_pricing_results = {**registration.server_pricing_results, 'total': 0}
        registration.save_without_recalc()

        response = self.client.post(self.url, {
            'step': 'payment', 'registrationUUID': str(sent['registrationUUID'])}, format='json')

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(models.Invoice.objects.get().amount, 0)


class StartingAgainTests(DraftTestCase):
    def test_it_deletes_the_draft(self):
        draft_uuid = self.save().data['uuid']
        response = self.client.delete(f'{self.url}/draft/{draft_uuid}')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(models.RegistrationDraft.objects.exists())

    def test_its_address_only_deletes(self):
        draft_uuid = self.save().data['uuid']
        response = self.client.post(f'{self.url}/draft/{draft_uuid}', {}, format='json')
        self.assertEqual(response.status_code, 405)

    def test_one_already_gone_is_fine(self):
        response = self.client.delete(f'{self.url}/draft/{uuid.uuid4()}')
        self.assertEqual(response.status_code, 204)

    def test_only_from_its_own_event(self):
        other = models.Event.objects.create(
            organization=self.event.organization, name='Other')
        draft_uuid = self.save().data['uuid']
        self.client.delete(f'/api/events/{other.id}/register/draft/{draft_uuid}')
        self.assertTrue(models.RegistrationDraft.objects.exists())


class AdminApiTests(DraftTestCase):
    def setUp(self):
        super().setUp()
        self.draft = models.RegistrationDraft.objects.create(
            event=self.event, registrant_email='pat@example.com',
            form_data={'registrant_email': 'pat@example.com'})

    def test_every_role_reads_them(self):
        for role in (roles.REGISTRAR, roles.ADMIN, roles.REPORTER):
            with self.subTest(role=role):
                self.client.force_authenticate(make_user(role, f'user-{role}'))
                listed = self.client.get(f'/api/registrationdrafts/?event={self.event.id}')
                self.assertEqual(listed.status_code, 200, listed.data)
                self.assertEqual([row['id'] for row in listed.data], [self.draft.id])
                self.assertEqual(listed.data[0]['form_data'], self.draft.form_data)
                one = self.client.get(f'/api/registrationdrafts/{self.draft.id}/')
                self.assertEqual(one.status_code, 200, one.data)
                # Whoever holds it can discard the draft, which a Reporter may not.
                self.assertNotIn('uuid', listed.data[0])
                self.assertNotIn('uuid', one.data)

    def test_no_one_signed_out_or_without_a_role(self):
        path = f'/api/registrationdrafts/?event={self.event.id}'
        self.assertEqual(self.client.get(path).status_code, 401)
        self.client.force_authenticate(make_user(None, 'nobody'))
        self.assertEqual(self.client.get(path).status_code, 403)

    def test_only_registrars_and_admins_delete(self):
        path = f'/api/registrationdrafts/{self.draft.id}/'
        self.client.force_authenticate(make_user(roles.REPORTER, 'rae'))
        self.assertEqual(self.client.delete(path).status_code, 403)
        self.client.force_authenticate(make_user(roles.REGISTRAR, 'reggie'))
        self.assertEqual(self.client.delete(path).status_code, 204)
        self.assertFalse(models.RegistrationDraft.objects.exists())

    def test_it_cant_be_written_through_the_api(self):
        self.client.force_authenticate(make_user(roles.ADMIN, 'boss'))
        path = f'/api/registrationdrafts/{self.draft.id}/'
        self.assertEqual(self.client.patch(path, {}, format='json').status_code, 405)
        self.assertEqual(
            self.client.post('/api/registrationdrafts/', {}, format='json').status_code, 405)


class TemplatesTests(DraftTestCase):
    def test_a_submitted_draft_is_an_incomplete_registration(self):
        self.submit()
        graph = build_event_graph(self.event)
        self.assertEqual(list(graph.registrations), [])
        self.assertEqual(list(graph.campers), [])
        [registration] = graph.incomplete_registrations
        self.assertFalse(registration['completed'])
        self.assertEqual(registration['registrant_email'],
                         self.valid_form_data['registrant_email'])
        self.assertEqual(len(registration['campers']), len(self.valid_form_data['campers']))
        self.assertEqual(registration['attributes']['billing_name'],
                         self.valid_form_data['billing_name'])

    def test_its_uuid_isnt_given_out(self):
        self.submit()
        [registration] = build_event_graph(self.event).incomplete_registrations
        self.assertEqual(registration['uuid'], '')

    def test_who_a_camper_would_have_shared_with_is_left_out_once_unticked(self):
        models.RegistrationDraft.objects.create(
            event=self.event, submitted_at=timezone.now(),
            form_data={'campers': [{'lodging': {
                'lodging_shared': False, 'lodging_shared_with': 'Lee'}}]})
        [registration] = build_event_graph(self.event).incomplete_registrations
        self.assertEqual(registration['campers'][0]['lodging_shared_with'], '')

    def test_one_being_filled_in_is_in_no_template(self):
        self.save()
        self.assertEqual(list(build_event_graph(self.event).incomplete_registrations), [])

    def test_it_holds_no_place_in_lodging_or_rosters(self):
        self.submit()
        graph = build_event_graph(self.event)
        for node in graph.lodgings:
            self.assertEqual(node['camper_count'], 0)


class PreviewTests(DraftTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(make_user(roles.ADMIN, 'boss'))

    def preview(self, **sample):
        return self.client.post(f'/api/events/{self.event.id}/templates/preview', {
            'context': 'bulk_email_registration', 'template': '{{ registration.registrant_email }}',
            'output': 'email', 'subject': 'Hello', **sample}, format='json')

    def test_a_group_email_previews_for_a_recipient_who_is_a_draft(self):
        self.submit()
        draft = models.RegistrationDraft.objects.get()
        response = self.preview(registration_id=f'draft-{draft.id}')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn(self.valid_form_data['registrant_email'], str(response.data))

    def test_an_id_that_is_no_ones_is_refused(self):
        for sample in ('nonsense', 'draft-999999'):
            with self.subTest(sample=sample):
                response = self.preview(registration_id=sample)
                self.assertEqual(response.status_code, 400)
                self.assertNotIn('output must be', str(response.data))


class AddedByAnOrganizerTests(DraftTestCase):
    def test_one_added_through_the_api_is_completed_and_emails_no_one(self):
        self.client.force_authenticate(make_user(roles.ADMIN, 'boss'))
        response = self.client.post('/api/registrations/', {
            'event': self.event.id, 'registrant_email': 'pat@example.com',
            'attributes': {key: value for key, value in self.valid_form_data.items()
                           if key not in ('campers', 'registrant_email')},
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        registration = models.Registration.objects.get()
        self.assertIsNotNone(registration.completed_at)
        self.assertIsNotNone(registration.confirmation_sent_at)


class ConfigTests(DraftTestCase):
    @override_settings(CAMPHORIC_INCOMPLETE_RETENTION_DAYS=12)
    def test_the_page_is_told_the_retention_period(self):
        self.assertEqual(self.client.get(self.url).data['draftRetentionDays'], 12)


@skipUnless(shutil.which('pg_dump'), 'Needs pg_dump: the image has it for `dbbackup`, CI may not.')
class BackupTests(TransactionTestCase):
    def test_a_dump_holds_the_table_but_none_of_its_rows(self):
        organization = models.Organization.objects.create(name='Org')
        event = models.Event.objects.create(organization=organization, name='Camp')
        models.RegistrationDraft.objects.create(event=event, registrant_email='secret@example.com')

        # In pg_dump's binary format: pg_restore reads it back as SQL.
        binary = get_connector('default').create_dump().read()
        dump = subprocess.run(
            ['pg_restore', '-f', '-'], input=binary, capture_output=True, check=True,
        ).stdout.decode()
        self.assertIn(f'CREATE TABLE public.{models.RegistrationDraft._meta.db_table}', dump)
        self.assertNotIn('secret@example.com', dump)


class QueryTests(DraftTestCase):
    def test_a_save_stays_cheap(self):
        draft_uuid = self.save().data['uuid']
        with CaptureQueriesContext(connection) as queries:
            self.save(uuid=str(draft_uuid))
        self.assertLess(len(queries), 10)

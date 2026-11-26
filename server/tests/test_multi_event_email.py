'''An organization's email to past campers (SPEC §8.12, DR-182).'''

import datetime

from django.core import mail
from django.utils import timezone
from freezegun import freeze_time

from camphoric import models
from camphoric.mail import unsubscribe
from camphoric.multi_event import people
from camphoric.templating import rules
from camphoric.test.tasks import run_due_tasks
from tests.test_multi_event import MultiEventTestCase, base, make_camper, make_event

Status = models.EmailMessageStatus


class MultiEventEmailTestCase(MultiEventTestCase):
    def setUp(self):
        super().setUp()
        ann = [make_camper(e, 'Ann', 'Lee', email='ann@example.com', registrant_email='lees@x.org')
               for e in (self.camp23, self.camp24, self.camp25)]
        people.link(self.organization, [c.id for c in ann])
        self.ann_key = f'person:{models.Camper.objects.get(id=ann[0].id).person_id}'
        self.bo = make_camper(self.camp23, 'Bo', 'Ng', registrant_email='ng@x.org')
        self.cy = make_camper(self.camp24, 'Cy', 'Day')  # no address at all
        self.email = models.OrganizationEmail.objects.create(
            organization=self.organization, name='Come back', from_email='camp@example.com',
            subject='{{ person.name }}, come back',
            body='You came {{ person.attended }} times; first at {{ person.first_event.name }}.')

    def recipients(self, rules=(), combinator='and', **extra):
        response = self.client.post(f'{base(self.organization.id)}/email/recipients', {
            'filter': {'combinator': combinator, 'rules': list(rules)}, **extra}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def keys(self, data):
        return [r['key'] for r in data['recipients']]

    def send(self, keys, **extra):
        return self.client.post(f'/api/organization-emails/{self.email.id}/send/',
                                {'recipient_keys': keys, **extra}, format='json')


class RecipientTests(MultiEventEmailTestCase):
    def test_everyone_once_with_reasons_for_the_rest(self):
        data = self.recipients()
        self.assertEqual(self.keys(data), [self.ann_key, f'camper:{self.bo.id}'])
        ann = data['recipients'][0]
        self.assertEqual((ann['email'], ann['name']), ('ann@example.com', 'Ann Lee'))
        self.assertEqual([(s['label'], s['reason']) for s in data['skipped']],
                         [('Cy Day', 'no_address')])

    def test_rules_choose_by_attendance(self):
        data = self.recipients([{'field': 'person.attended', 'op': 'gte', 'value': 2}])
        self.assertEqual(self.keys(data), [self.ann_key])
        data = self.recipients([{'field': 'person.series', 'op': 'contains', 'value': 'Camp'},
                                {'field': 'person.last_year', 'op': 'lt', 'value': 2025}])
        self.assertEqual(self.keys(data), [f'camper:{self.bo.id}'])

    def test_not_registered_for_an_event_left_out_of_reports(self):
        upcoming = make_event(self.organization, 'Camp 2026', 2026, included=False)
        # Bo has registered for 2026 under the same address, not yet linked.
        make_camper(upcoming, 'Bo', 'Ng', registrant_email='NG@x.org')
        rule = {'field': 'person.registered', 'op': 'not_contains', 'value': 'Camp 2026'}
        self.assertEqual(self.keys(self.recipients([rule])), [self.ann_key])

    def test_registered_under_another_of_their_addresses(self):
        upcoming = make_event(self.organization, 'Camp 2026', 2026, included=False)
        # Ann's parent registers her under the family address, with no email of her own.
        make_camper(upcoming, 'Ann', 'Lee', registrant_email='lees@x.org')
        # A sibling registered under Bo's family address doesn't make Bo registered.
        make_camper(upcoming, 'Di', 'Ng', registrant_email='ng@x.org')
        rule = {'field': 'person.registered', 'op': 'not_contains', 'value': 'Camp 2026'}
        self.assertEqual(self.keys(self.recipients([rule])), [f'camper:{self.bo.id}'])

    def test_events_with_the_same_name_are_told_apart(self):
        make_event(self.organization, 'Camp 2023', 2026, included=False)
        response = self.client.get(f'{base(self.organization.id)}/email/recipient-fields')
        options = [o['value'] for o in
                   {f['key']: f for f in response.data}['person.registered']['options']]
        self.assertIn('Camp 2023 (2023)', options)
        self.assertIn('Camp 2023 (2026)', options)

    def test_latest_answers(self):
        latest = models.Camper.objects.get(person_id=int(self.ann_key.split(':')[1]),
                                           registration__event=self.camp25)
        latest.attributes = {**latest.attributes, 'instrument': 'Fiddle'}
        latest.save()
        rule = {'field': 'latest.camper.attributes.instrument', 'op': 'is', 'value': 'fiddle'}
        self.assertEqual(self.keys(self.recipients([rule])), [self.ann_key])

    def test_unsubscribes_from_the_organization_or_an_included_event(self):
        unsubscribe.unsubscribe_organization(self.organization, 'Ann@Example.com', source='link')
        models.EmailUnsubscribe.objects.create(event=self.camp23, email='ng@x.org',
                                               source='link')
        data = self.recipients()
        self.assertEqual(self.keys(data), [])
        self.assertEqual(sorted(s['reason'] for s in data['skipped']),
                         ['no_address', 'unsubscribed', 'unsubscribed'])

    def test_records_sharing_an_address_get_one_copy(self):
        make_camper(self.camp25, 'Di', 'Ng', registrant_email='ng@x.org')
        data = self.recipients()
        self.assertEqual(len(data['recipients']), 2)
        self.assertIn('duplicate', [s['reason'] for s in data['skipped']])

    def test_bad_rules_are_reported(self):
        data = self.recipients([{'field': 'person.attended', 'op': 'gte'}])
        self.assertEqual(data['recipients'], [])
        self.assertTrue(data['diagnostics'])

    def test_fields_for_the_rule_builder(self):
        response = self.client.get(f'{base(self.organization.id)}/email/recipient-fields')
        fields = {f['key']: f for f in response.data}
        self.assertEqual(fields['person.attended']['type'], 'number')
        self.assertIn('Camp 2023',
                      [o['value'] for o in fields['person.events']['options']])
        self.assertIn('not_contains', rules.OPERATORS[fields['person.registered']['type']])


class EmailApiTests(MultiEventEmailTestCase):
    def test_saving_checks_the_template_rules_and_account(self):
        created = self.client.post('/api/organization-emails/', {
            'organization': self.organization.id, 'name': 'Bad', 'body': '{% if %}',
            'filter': {'combinator': 'and', 'rules': [{'field': 'x', 'op': 'nope'}]}},
            format='json')
        self.assertEqual(created.status_code, 400)
        self.assertEqual(set(created.data), {'body', 'filter'})
        theirs = models.EmailAccount.objects.create(
            organization=self.other_organization, name='Theirs', host='smtp.example.com',
            port=587)
        response = self.client.patch(f'/api/organization-emails/{self.email.id}/',
                                     {'account': theirs.id}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_reporters_see_who_it_reaches_but_dont_send(self):
        self.client.force_authenticate(self.reporter)
        self.assertEqual(len(self.recipients()['recipients']), 2)
        self.assertEqual(self.send([self.ann_key]).status_code, 403)

    def test_preview_renders_for_a_person(self):
        response = self.client.post(f'{base(self.organization.id)}/templates/preview', {
            'output': 'email', 'template': self.email.body, 'subject': self.email.subject,
            'recipient_key': self.ann_key}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['subject'], 'Ann Lee, come back')
        self.assertEqual(response.data['output'], 'You came 3 times; first at Camp 2023.')
        self.assertEqual(response.data['sample']['kind'], 'person')


class SendTests(MultiEventEmailTestCase):
    def test_sends_one_copy_per_person_with_an_unsubscribe_link(self):
        response = self.send([self.ann_key, f'camper:{self.bo.id}'])
        self.assertEqual(response.status_code, 202, response.data)
        batch = models.EmailBatch.objects.get(id=response.data['id'])
        self.assertEqual((batch.organization, batch.event), (self.organization, None))
        ann = batch.messages.get(recipient_key=self.ann_key)
        self.assertEqual((ann.kind, ann.organization, ann.status),
                         (models.EmailMessageKind.MULTI_EVENT, self.organization, Status.SENT))
        self.assertEqual(ann.to, 'Ann Lee <ann@example.com>')
        self.assertTrue(ann.text.startswith('You came 3 times; first at Camp 2023.\n\n--\n'))
        self.assertIn('an event of Lark', ann.text)
        self.assertEqual(len(mail.outbox), 2)

        history = self.client.get(f'/api/emailmessages/?organization={self.organization.id}')
        self.assertEqual(history.data['count'], 2)
        batches = self.client.get(f'/api/emailbatches/?organization={self.organization.id}')
        self.assertEqual(batches.data[0]['state'], 'done')

    def test_the_unsubscribe_link_leaves_the_organizations_email(self):
        self.send([self.ann_key])
        message = models.EmailMessage.objects.get(recipient_key=self.ann_key)
        token = message.unsubscribe_url.rstrip('/').rsplit('/', 1)[1]
        page = self.client.get(f'/api/email/unsubscribe/{token}')
        self.assertEqual((page.data['scope'], page.data['event']['name']),
                         ('organization', 'Lark'))
        self.client.post(f'/api/email/unsubscribe/{token}')
        self.assertTrue(models.OrganizationUnsubscribe.objects.filter(
            organization=self.organization, email='ann@example.com').exists())
        # From events made since, too: the address is skipped from now on.
        self.assertEqual(self.keys(self.recipients()), [f'camper:{self.bo.id}'])

    def test_not_again_to_those_already_sent(self):
        self.send([self.ann_key])
        second = models.EmailBatch.objects.get(id=self.send([self.ann_key]).data['id'])
        self.assertEqual(second.messages.count(), 0)
        self.assertEqual(second.skipped[0]['reason'], 'already_sent')

    def test_already_sent_holds_after_records_are_linked(self):
        self.send([f'camper:{self.bo.id}'])
        bo25 = make_camper(self.camp25, 'Bo', 'Ng', registrant_email='ng@x.org')
        person = people.link(self.organization, [self.bo.id, bo25.id])
        key = f'person:{person.pk}'
        data = self.recipients(email=self.email.id)
        self.assertTrue({r['key']: r for r in data['recipients']}[key]['already_sent'])
        again = models.EmailBatch.objects.get(id=self.send([key]).data['id'])
        self.assertEqual(again.messages.count(), 0)
        self.assertEqual(again.skipped[0]['reason'], 'already_sent')

    def test_the_send_dialogs_account_and_reply_to_win(self):
        ours = models.EmailAccount.objects.create(
            organization=self.organization, name='Ours', host='smtp.example.com', port=587)
        self.email.account, self.email.reply_to = ours, 'office@example.com'
        self.email.save()
        chosen = models.EmailBatch.objects.get(id=self.send(
            [self.ann_key], account=None, reply_to='').data['id'])
        self.assertEqual((chosen.account, chosen.reply_to), (None, ''))
        saved = models.EmailBatch.objects.get(id=self.send(
            [self.ann_key], skip_already_sent=False).data['id'])
        self.assertEqual((saved.account, saved.reply_to), (ours, 'office@example.com'))

    def test_someone_unsubscribed_since_review_is_skipped(self):
        unsubscribe.unsubscribe_organization(self.organization, 'ann@example.com', source='link')
        batch = models.EmailBatch.objects.get(id=self.send([self.ann_key]).data['id'])
        self.assertEqual(batch.messages.count(), 0)
        self.assertEqual(batch.skipped[0]['reason'], 'unsubscribed')
        self.assertEqual(batch.skipped[0]['key'], self.ann_key)

    def test_needs_recipients_and_a_sender(self):
        self.assertEqual(self.send([]).status_code, 400)
        self.email.from_email = ''
        self.email.save()
        self.assertEqual(self.send([self.ann_key]).status_code, 400)

    def test_send_later_and_cancel(self):
        start = timezone.now()
        later = start + datetime.timedelta(hours=2)
        data = self.send([self.ann_key], send_at=later.isoformat()).data
        response = self.client.post(f'/api/emailbatches/{data["id"]}/cancel/')
        self.assertEqual(response.data['state'], 'cancelled')
        with freeze_time(later + datetime.timedelta(minutes=1)):
            run_due_tasks()
        self.assertEqual(models.EmailBatch.objects.get(id=data['id']).messages.count(), 0)
        self.assertEqual(mail.outbox, [])

    def test_test_send(self):
        response = self.client.post(f'/api/organization-emails/{self.email.id}/test/',
                                    {'to': 'me@example.com', 'subject': 'Hi {{ person.name }}'},
                                    format='json')
        self.assertEqual(response.status_code, 202, response.data)
        [message] = mail.outbox
        self.assertEqual((message.to, message.subject), (['me@example.com'], '[Test] Hi Ann Lee'))
        self.assertEqual(models.EmailMessage.objects.get().organization, self.organization)

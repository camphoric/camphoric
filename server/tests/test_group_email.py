'''
Group email (SPEC §8.9, DR-45): recipient rules, the field catalog, the
recipients preview, and sending templates in batches through the outbox.
'''

import datetime

from django.contrib.auth.models import User
from django.core import mail
from django.test import SimpleTestCase, override_settings
from django.utils import timezone
from freezegun import freeze_time
from rest_framework.test import APITestCase

from camphoric import models
from camphoric.templating import rules
from camphoric.test.tasks import clear_deferred_tasks, run_due_tasks
from tests.factories import create_template_event

Status = models.EmailMessageStatus

NO_WORKER = override_settings(TASKS={'default': {
    'BACKEND': 'django.tasks.backends.dummy.DummyBackend', 'QUEUES': ['email', 'default']}})


class RuleTests(SimpleTestCase):
    CONTEXT = {
        'registration': {'balance': 25, 'payment_type': 'Check', 'created_at':
                         datetime.datetime(2026, 5, 1, 12, tzinfo=datetime.timezone.utc),
                         'attributes': {'comments': 'Vegan please', 'empty': ''}},
        'camper': {'attributes': {'linens': True, 'days': ['Fri', 'Sat'],
                                  'birthdate': '2010-03-04'}},
    }

    def check(self, field, op, value, expected):
        self.assertEqual(rules.matches({'field': field, 'op': op, 'value': value},
                                       self.CONTEXT), expected, (field, op, value))

    def test_numbers(self):
        for op, value, expected in [('gt', 0, True), ('gt', 25, False), ('gte', '25', True),
                                    ('lt', 30, True), ('lte', 24, False), ('eq', 25, True),
                                    ('ne', 25, False)]:
            self.check('registration.balance', op, value, expected)

    def test_text(self):
        self.check('registration.attributes.comments', 'contains', 'VEGAN', True)
        self.check('registration.attributes.comments', 'not_contains', 'meat', True)
        self.check('registration.payment_type', 'is', 'check', True)
        self.check('registration.payment_type', 'is_not', 'Check', False)
        self.check('registration.payment_type', 'any_of', ['PayPal', 'Check'], True)

    def test_set_and_booleans(self):
        self.check('registration.attributes.comments', 'is_set', None, True)
        self.check('registration.attributes.empty', 'is_set', None, False)
        self.check('registration.attributes.missing', 'is_not_set', None, True)
        self.check('camper.attributes.linens', 'is_true', None, True)
        self.check('camper.attributes.missing', 'is_false', None, True)

    def test_dates_and_lists(self):
        self.check('registration.created_at', 'before', '2026-06-01', True)
        self.check('registration.created_at', 'on', '2026-05-01', True)
        self.check('camper.attributes.birthdate', 'after', '2009-12-31', True)
        self.check('camper.attributes.days', 'contains', 'sat', True)
        self.check('camper.attributes.days', 'any_of', ['Sun', 'Fri'], True)
        self.check('camper.attributes.days', 'any_of', ['Sun'], False)

    def test_combinators_and_structure(self):
        rule_gt = {'field': 'registration.balance', 'op': 'gt', 'value': 100}
        rule_check = {'field': 'registration.payment_type', 'op': 'is', 'value': 'Check'}
        either, _ = rules.compile_rules({'combinator': 'or', 'rules': [rule_gt, rule_check]})
        both, _ = rules.compile_rules({'combinator': 'and', 'rules': [rule_gt, rule_check]})
        self.assertTrue(either(self.CONTEXT))
        self.assertFalse(both(self.CONTEXT))
        everyone, problems = rules.compile_rules(None)
        self.assertTrue(everyone(self.CONTEXT))
        self.assertEqual(problems, [])
        for bad in [{'combinator': 'xor', 'rules': []}, {'rules': [{'field': 'a', 'op': 'zz'}]},
                    {'rules': [{'field': 'a', 'op': 'gt'}]}, {'rules': [{'op': 'is_set'}]},
                    'nope']:
            predicate, problems = rules.compile_rules(bad)
            self.assertIsNone(predicate, bad)
            self.assertTrue(problems, bad)


class GroupEmailTestCase(APITestCase):
    def setUp(self):
        clear_deferred_tasks()
        self.admin = User.objects.create_superuser('admin', 'admin@camp.org', 'pw')
        self.client.force_authenticate(user=self.admin)
        self.made = create_template_event()
        self.event = self.made.event
        self.template = models.EmailTemplate.objects.create(
            event=self.event, purpose='group', name='Packing list',
            subject='Packing for {{ event.name }}',
            body='Hi {{ recipient.name or recipient.email }}!',
            recipient_source='campers')

    def url(self, suffix):
        return f'/api/emailtemplates/{self.template.id}/{suffix}'

    def send(self, keys, **fields):
        return self.client.post(self.url('send/'), {'recipient_keys': keys, **fields},
                                format='json')

    def recipients(self, **fields):
        response = self.client.post(f'/api/events/{self.event.id}/email/recipients', fields,
                                    format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data


class RecipientTests(GroupEmailTestCase):
    def test_field_catalog(self):
        def catalog(source):
            response = self.client.get(
                f'/api/events/{self.event.id}/email/recipient-fields?source={source}')
            return {f['key']: f for f in response.data}

        registrations = catalog('registrations')
        self.assertEqual(registrations['registration.balance']['type'], 'number')
        self.assertEqual(registrations['registration.registration_type.label']['options'],
                         [{'value': 'Staff', 'label': 'Staff'}])
        self.assertFalse(any(key.startswith('camper.') for key in registrations))
        campers = catalog('campers')
        self.assertEqual(campers['camper.attributes.meal_type']['type'], 'enum')
        self.assertEqual(campers['camper.attributes.attendance']['type'], 'list')
        self.assertEqual([o['value'] for o in campers['camper.attributes.attendance']['options']],
                         ['Fri', 'Sat'])
        self.assertEqual(campers['camper.attributes.emergency_contact.name']['label'],
                         'Emergency contact › Full name')
        self.assertEqual(campers['camper.attributes.linens']['group'], 'Camper answers')

    def test_rules_choose_recipients(self):
        balance_due = {'combinator': 'and', 'rules': [
            {'field': 'registration.balance', 'op': 'gt', 'value': 0}]}
        data = self.recipients(recipient_source='registrations', filter=balance_due)
        self.assertEqual([r['key'] for r in data['recipients']],
                         [f'registration:{self.made.r1.id}'])
        linens = {'combinator': 'and', 'rules': [
            {'field': 'camper.attributes.linens', 'op': 'is_true'}]}
        data = self.recipients(recipient_source='campers', filter=linens)
        self.assertEqual([r['key'] for r in data['recipients']], [f'camper:{self.made.c1.id}'])

    def test_rules_and_expression_both_apply(self):
        data = self.recipients(
            recipient_source='campers', filter_expression="camper.attributes.last_name == 'Alpha'",
            filter={'combinator': 'and', 'rules': [
                {'field': 'camper.attributes.first_name', 'op': 'is', 'value': 'Sam'}]})
        self.assertEqual([r['key'] for r in data['recipients']], [f'camper:{self.made.c2.id}'])

    def test_bad_rules_are_diagnostics(self):
        data = self.recipients(recipient_source='campers', filter={'rules': [{'op': 'nope'}]})
        self.assertEqual(data['recipients'], [])
        self.assertEqual(data['diagnostics'][0]['field'], 'filter')

    def test_already_sent_is_marked(self):
        self.send([f'camper:{self.made.c3.id}'])
        data = self.recipients(recipient_source='campers', template=self.template.id)
        sent = {r['key']: r['already_sent'] for r in data['recipients']}
        self.assertTrue(sent[f'camper:{self.made.c3.id}'])
        self.assertFalse(sent[f'camper:{self.made.c1.id}'])


class SendTests(GroupEmailTestCase):
    def test_sends_to_the_reviewed_recipients(self):
        keys = [f'camper:{self.made.c1.id}', f'camper:{self.made.c3.id}']
        response = self.send(keys)
        self.assertEqual(response.status_code, 202, response.data)
        batch = models.EmailBatch.objects.get(id=response.data['id'])
        self.assertEqual(batch.recipient_keys, keys)
        messages = batch.messages.order_by('recipient_key')
        self.assertEqual(sorted(m.recipient_key for m in messages), sorted(keys))
        pat = messages.get(recipient_key=f'camper:{self.made.c1.id}')
        self.assertEqual(pat.kind, models.EmailMessageKind.BULK)
        self.assertEqual(pat.template, self.template)
        self.assertEqual(pat.to, 'Pat Alpha <pat@example.com>')
        self.assertEqual(pat.subject, 'Packing for Test Camp')
        self.assertTrue(pat.text.startswith('Hi Pat Alpha!\n\n--\n'), pat.text)
        self.assertTrue(pat.unsubscribe_url.startswith('http://testserver/api/unsubscribe/'))
        self.assertEqual(len(mail.outbox), 2)

        data = self.client.get(f'/api/emailbatches/{batch.id}/').data
        self.assertEqual((data['total'], data['sent'], data['state']), (2, 2, 'done'))

    def test_one_copy_per_address(self):
        # Pat and Sam share their registration's address.
        batch = self.send([f'camper:{self.made.c1.id}', f'camper:{self.made.c2.id}']).data
        batch = models.EmailBatch.objects.get(id=batch['id'])
        self.assertEqual(batch.messages.count(), 1)
        self.assertEqual([s['reason'] for s in batch.skipped], ['duplicate'])

    def test_not_again_to_those_already_sent(self):
        keys = [f'camper:{self.made.c1.id}']
        self.send(keys)
        second = models.EmailBatch.objects.get(id=self.send(keys).data['id'])
        self.assertEqual(second.messages.count(), 0)
        self.assertEqual(second.skipped[0]['reason'], 'already_sent')
        third = self.send(keys, skip_already_sent=False).data
        self.assertEqual(models.EmailBatch.objects.get(id=third['id']).messages.count(), 1)

    def test_a_copy_that_cannot_render_fails(self):
        self.template.body = '{{ camper.attributes.nope.deeper }}'
        self.template.save()
        data = self.send([f'camper:{self.made.c1.id}']).data
        batch = models.EmailBatch.objects.get(id=data['id'])
        [message] = batch.messages.all()
        self.assertEqual(message.status, Status.FAILED)
        self.assertIn("couldn't be rendered", message.last_error)
        self.assertEqual(mail.outbox, [])

    def test_a_recipient_gone_since_is_skipped(self):
        key = f'camper:{self.made.c3.id}'
        self.made.c3.delete()
        batch = models.EmailBatch.objects.get(id=self.send([key]).data['id'])
        self.assertEqual(batch.skipped, [{'key': key, 'label': key, 'reason': 'gone'}])

    def test_listed_addresses(self):
        self.template.recipient_source = 'manual'
        self.template.recipient_list = 'Kim <kim@example.com>\nlee@example.com'
        self.template.save()
        keys = [r['key'] for r in self.recipients(
            recipient_source='manual', recipient_list=self.template.recipient_list)['recipients']]
        self.assertEqual(keys, ['address:kim@example.com', 'address:lee@example.com'])
        self.send(keys[:1])
        self.assertEqual(mail.outbox[0].to, ['Kim <kim@example.com>'])

    def test_needs_recipients_and_a_group_template(self):
        self.assertEqual(self.send([]).status_code, 400)
        confirmation = self.event.confirmation_template
        response = self.client.post(f'/api/emailtemplates/{confirmation.id}/send/',
                                    {'recipient_keys': ['camper:1']}, format='json')
        self.assertEqual(response.status_code, 400)


class ScheduleAndCancelTests(GroupEmailTestCase):
    def test_send_later_waits_and_can_be_cancelled(self):
        start = datetime.datetime(2026, 9, 1, 12, tzinfo=datetime.timezone.utc)
        with freeze_time(start) as clock:
            later = start + datetime.timedelta(hours=2)
            data = self.send([f'camper:{self.made.c1.id}'], send_at=later.isoformat()).data
            batch = models.EmailBatch.objects.get(id=data['id'])
            self.assertEqual((batch.status, batch.send_at), ('scheduled', later))
            self.assertEqual(batch.messages.count(), 0)

            clock.tick(datetime.timedelta(hours=2))
            run_due_tasks()
        batch.refresh_from_db()
        self.assertEqual(batch.status, 'sending')
        self.assertEqual(batch.messages.get().status, Status.SENT)

        data = self.send([f'camper:{self.made.c3.id}'],
                         send_at=(timezone.now() + datetime.timedelta(hours=1)).isoformat()).data
        response = self.client.post(f'/api/emailbatches/{data["id"]}/cancel/')
        self.assertEqual(response.data['state'], 'cancelled')
        with freeze_time(timezone.now() + datetime.timedelta(hours=2)):
            run_due_tasks()
        self.assertEqual(models.EmailBatch.objects.get(id=data['id']).messages.count(), 0)

    @NO_WORKER
    def test_cancel_while_sending(self):
        # With no worker, expanding and delivery wait; run the expansion by hand.
        from camphoric.mail import batches
        data = self.send([f'camper:{self.made.c1.id}', f'camper:{self.made.c3.id}']).data
        batches.expand(data['id'])
        response = self.client.post(f'/api/emailbatches/{data["id"]}/cancel/')
        self.assertEqual((response.data['cancelled'], response.data['waiting']), (2, 0))
        self.assertEqual(mail.outbox, [])

    def test_retry_failed(self):
        data = self.send([f'camper:{self.made.c1.id}']).data
        models.EmailMessage.objects.filter(batch_id=data['id']).update(status=Status.FAILED)
        response = self.client.post(f'/api/emailbatches/{data["id"]}/retry-failed/')
        self.assertEqual(response.data['retried'], 1)
        self.assertEqual(response.data['sent'], 1)


class TemplateTests(GroupEmailTestCase):
    def test_test_send(self):
        response = self.client.post(self.url('test/'), {
            'recipient_key': f'camper:{self.made.c3.id}', 'body': 'Unsaved: {{ recipient.name }}',
        }, format='json')
        self.assertEqual(response.status_code, 202, response.data)
        self.assertEqual(response.data['rendered_for']['key'], f'camper:{self.made.c3.id}')
        [message] = mail.outbox
        self.assertEqual(message.to, ['admin@camp.org'])
        self.assertEqual(message.subject, '[Test] Packing for Test Camp')
        self.assertEqual(message.body, 'Unsaved: Lee Beta')

    def test_test_send_with_problems(self):
        response = self.client.post(self.url('test/'), {'body': '{{ camper.nope.deeper }}'},
                                    format='json')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(response.data['diagnostics'])
        self.assertEqual(mail.outbox, [])

    def test_saving_checks_the_audience(self):
        response = self.client.patch(self.url(''), {
            'filter': {'rules': [{'field': 'x', 'op': 'bogus'}]},
            'filter_expression': 'camper ==',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('filter', response.data)
        self.assertIn('filter_expression', response.data)

    def test_duplicate(self):
        response = self.client.post(self.url('duplicate/'))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['name'], 'Packing list (copy)')
        self.assertEqual(response.data['recipient_source'], 'campers')
        self.assertNotEqual(response.data['id'], self.template.id)

    def test_template_checks(self):
        from camphoric.templating.checks import check_event_templates
        self.template.body = '{{ camper.attributes.nope.deeper }}'
        self.template.save()
        models.EmailTemplate.objects.create(
            event=self.event, purpose='group', name='Nobody yet', subject='Hi {{ event.name }}',
            body='{% if %}', recipient_source='manual')
        results = {r.label: r for r in check_event_templates(self.event)
                   if r.kind == 'group_email'}
        rendered = results['Group email: Packing list']
        self.assertEqual(rendered.mode, 'rendered')
        self.assertTrue(rendered.errors)
        # No recipients to render for: the syntax is still checked.
        parsed = results['Group email: Nobody yet']
        self.assertEqual(parsed.mode, 'parsed')
        self.assertEqual([d.field for d in parsed.errors], ['template'])

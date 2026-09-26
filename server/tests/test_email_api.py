'''
The email history, queue and account API behind the admin's Email pages
(SPEC DR-44).
'''

import datetime

from django.contrib.auth.models import User
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from camphoric import models
from camphoric.mail import outbox

Kind = models.EmailMessageKind
Status = models.EmailMessageStatus

NO_WORKER = override_settings(TASKS={'default': {
    'BACKEND': 'django.tasks.backends.dummy.DummyBackend', 'QUEUES': ['email', 'default']}})


class EmailApiTestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser('admin', 'admin@example.com', 'pw')
        self.client.force_authenticate(user=self.admin)
        self.organization = models.Organization.objects.create(name='Org')
        self.account = models.EmailAccount.objects.create(
            organization=self.organization, name='Camp Gmail', host='smtp.example.com',
            port=587, username='camp@example.com', password='secret')
        self.event = models.Event.objects.create(
            organization=self.organization, name='Camp', email_account=self.account)

    def message(self, **fields):
        return models.EmailMessage.objects.create(**{
            'event': self.event, 'kind': Kind.CONFIRMATION, 'account': self.account,
            'to': 'pat@example.com', 'from_email': 'camp@example.com',
            'subject': 'Welcome', 'text': 'Hi', 'html': '<p>Hi</p>', **fields})


class HistoryTests(EmailApiTestCase):
    def test_list_is_newest_first_and_leaves_out_content(self):
        older = self.message(subject='Older')
        newer = self.message(subject='Newer')
        response = self.client.get(f'/api/emailmessages/?event={self.event.id}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        results = response.data['results']
        self.assertEqual([m['id'] for m in results], [newer.id, older.id])
        self.assertNotIn('text', results[0])
        self.assertNotIn('html', results[0])
        self.assertEqual(results[0]['account_name'], 'Camp Gmail')

    def test_pages_of_fifty(self):
        models.EmailMessage.objects.bulk_create([
            models.EmailMessage(event=self.event, kind=Kind.BULK, to=f'p{i}@example.com',
                                from_email='camp@example.com', subject='Hi', text='Hi')
            for i in range(55)])
        first = self.client.get('/api/emailmessages/').data
        self.assertEqual((first['count'], len(first['results'])), (55, 50))
        second = self.client.get(first['next']).data
        self.assertEqual(len(second['results']), 5)

    def test_filters_and_search(self):
        self.message(kind=Kind.CONFIRMATION_REPORT, status=Status.SENT)
        self.message(kind=Kind.PAGE_REPORT, status=Status.FAILED)
        self.message(kind=Kind.INVITATION, to='lee@example.com', subject='Join us')
        other_event = models.Event.objects.create(organization=self.organization, name='Other')
        self.message(event=other_event)

        def count(query):
            return self.client.get(f'/api/emailmessages/?{query}').data['count']

        self.assertEqual(count(f'event={self.event.id}'), 3)
        self.assertEqual(count('kind__in=confirmation_report,page_report'), 2)
        self.assertEqual(count('status=failed'), 1)
        self.assertEqual(count('q=lee@'), 1)
        self.assertEqual(count('q=join'), 1)

    def test_detail_has_the_content(self):
        message = self.message()
        data = self.client.get(f'/api/emailmessages/{message.id}/').data
        self.assertEqual((data['text'], data['html']), ('Hi', '<p>Hi</p>'))
        self.assertNotIn('dedupe_key', data)

    def test_admins_only(self):
        self.client.force_authenticate(user=None)
        for url in ['/api/emailmessages/', f'/api/events/{self.event.id}/email/queue']:
            self.assertIn(self.client.get(url).status_code, (401, 403))


class RetryAndCancelTests(EmailApiTestCase):
    def test_retry_a_failed_message(self):
        message = self.message(status=Status.FAILED, attempts=6, last_error='550 no')
        response = self.client.post(f'/api/emailmessages/{message.id}/retry/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], Status.SENT)
        self.assertEqual(len(mail.outbox), 1)

    def test_only_failed_messages_can_be_retried(self):
        for status in [Status.SENT, Status.CANCELLED, Status.QUEUED]:
            with self.subTest(status=status):
                message = self.message(status=status)
                response = self.client.post(f'/api/emailmessages/{message.id}/retry/')
                self.assertEqual(response.status_code, 409)
        self.assertEqual(mail.outbox, [])

    def test_a_bad_address_is_not_retried(self):
        message = self.message(status=Status.FAILED, to='x@dontsend.com')
        response = self.client.post(f'/api/emailmessages/{message.id}/retry/')
        self.assertEqual(response.status_code, 409)
        self.assertIn('@dontsend.com', response.data['detail'])

    def test_cancel_a_queued_message(self):
        message = self.message()
        response = self.client.post(f'/api/emailmessages/{message.id}/cancel/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], Status.CANCELLED)
        self.assertEqual(outbox.deliver(message.id), 'skipped')
        self.assertEqual(mail.outbox, [])

    def test_a_sent_message_cannot_be_cancelled(self):
        message = self.message(status=Status.SENT)
        self.assertEqual(self.client.post(f'/api/emailmessages/{message.id}/cancel/').status_code,
                         409)


class QueueTests(EmailApiTestCase):
    def queue(self):
        response = self.client.get(f'/api/events/{self.event.id}/email/queue')
        self.assertEqual(response.status_code, 200)
        return response.data

    def test_counts_and_worker(self):
        soon = timezone.now() + datetime.timedelta(minutes=5)
        self.message(next_attempt_at=soon)
        self.message(status=Status.FAILED)
        state = self.queue()
        self.assertEqual((state['queued'], state['sending'], state['failed_last_day']), (1, 0, 1))
        self.assertEqual(state['next_attempt_at'], soon)
        self.assertEqual(state['worker'], {'required': True, 'alive': False, 'last_seen': None})

        models.WorkerHeartbeat.objects.create(worker_id='w', hostname='h', pid=1,
                                              started_at=timezone.now(),
                                              seen_at=timezone.now())
        self.assertTrue(self.queue()['worker']['alive'])

    def test_account_limits(self):
        self.account.max_per_minute = 2
        self.account.save()
        now = timezone.now()
        for _ in range(2):
            self.message(status=Status.SENT, sent_at=now - datetime.timedelta(seconds=30))
        account = self.queue()['account']
        self.assertEqual(account['name'], 'Camp Gmail')
        self.assertEqual((account['sent_last_minute'], account['sent_last_day']), (2, 2))
        self.assertAlmostEqual(account['paused_until'].timestamp(),
                               (now + datetime.timedelta(seconds=30)).timestamp(), delta=1)

    def test_without_an_account(self):
        self.event.email_account = None
        self.event.save()
        self.assertIsNone(self.queue()['account'])


class AccountTests(EmailApiTestCase):
    def url(self, suffix=''):
        return f'/api/emailaccounts/{self.account.id}/{suffix}'

    def test_password_is_write_only(self):
        data = self.client.get(self.url()).data
        self.assertNotIn('password', data)
        self.assertEqual(data['password_status'], 'set')

    def test_a_blank_password_keeps_the_stored_one(self):
        response = self.client.patch(self.url(), {'password': '', 'max_per_day': 500},
                                     format='json')
        self.assertEqual(response.status_code, 200)
        self.account.refresh_from_db()
        self.assertEqual(self.account.password, 'secret')
        self.assertEqual(self.account.max_per_day, 500)

        self.client.patch(self.url(), {'password': 'new-secret'}, format='json')
        self.account.refresh_from_db()
        self.assertEqual(self.account.password, 'new-secret')

    def test_an_account_in_use_cannot_be_deleted(self):
        response = self.client.delete(self.url())
        self.assertEqual(response.status_code, 409)
        self.assertTrue(models.EmailAccount.objects.filter(id=self.account.id).exists())

        self.event.email_account = None
        self.event.save()
        self.assertEqual(self.client.delete(self.url()).status_code, 204)

    def test_send_a_test_message(self):
        response = self.client.post(self.url('test/'), {'to': 'me@example.com'}, format='json')
        self.assertEqual(response.status_code, 202)
        message = models.EmailMessage.objects.get(id=response.data['id'])
        self.assertIsNone(message.event)
        self.assertEqual(message.account, self.account)
        self.assertEqual(message.kind, Kind.TEST)
        self.assertEqual(message.created_by, self.admin)
        self.assertEqual(mail.outbox[0].to, ['me@example.com'])
        self.assertEqual(mail.outbox[0].from_email, 'camp@example.com')

    def test_a_test_message_goes_to_the_admin_by_default(self):
        self.client.post(self.url('test/'))
        self.assertEqual(mail.outbox[0].to, ['admin@example.com'])


class InvitationEmailStatusTests(EmailApiTestCase):
    @NO_WORKER
    def test_the_latest_email_is_reported(self):
        registration_type = models.RegistrationType.objects.create(
            event=self.event, name='staff', label='Staff')
        invitation = models.Invitation.objects.create(
            registration_type=registration_type, recipient_email='lee@example.com')
        url = f'/api/invitations/{invitation.id}/'
        self.assertIsNone(self.client.get(url).data['email'])

        self.message(kind=Kind.INVITATION, invitation=invitation, status=Status.FAILED,
                     last_error='550 no such user')
        latest = self.message(kind=Kind.INVITATION, invitation=invitation)
        email = self.client.get(url).data['email']
        self.assertEqual((email['id'], email['status'], email['error']),
                         (latest.id, Status.QUEUED, ''))

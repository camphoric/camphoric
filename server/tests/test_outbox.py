import datetime
import smtplib
from unittest import mock

from django.core import mail
from django.test import TestCase
from django.utils import timezone
from freezegun import freeze_time

from camphoric import models
from camphoric.mail import outbox
from camphoric.mail.mailers import AccountUnusable
from camphoric.test.tasks import clear_deferred_tasks, run_due_tasks

Status = models.EmailMessageStatus
START = datetime.datetime(2026, 9, 1, 12, 0, tzinfo=datetime.timezone.utc)


class FlakyMailer:
    '''Raises the given errors on successive sends, then delivers to the outbox.'''

    def __init__(self, *errors):
        self.errors = list(errors)

    def send_messages(self, messages):
        if self.errors:
            raise self.errors.pop(0)
        mail.outbox.extend(messages)
        return len(messages)


class OutboxTestCase(TestCase):
    def setUp(self):
        clear_deferred_tasks()
        self.organization = models.Organization.objects.create(name='Test Organization')
        self.account = models.EmailAccount.objects.create(
            organization=self.organization, name='account', host='smtp.example.com',
            port=587, username='user', password='secret')
        self.event = models.Event.objects.create(
            organization=self.organization, name='Camp', email_account=self.account)

    def enqueue(self, to='camper@example.com', **kwargs):
        fields = dict(event=self.event, kind=models.EmailMessageKind.CONFIRMATION, to=to,
                      subject='Hello', text='Hi there', html='<p>Hi there</p>',
                      from_email='camp@example.com')
        return outbox.enqueue(**{**fields, **kwargs})

    def flaky(self, *errors):
        return mock.patch('camphoric.mail.outbox.mailer_for', return_value=FlakyMailer(*errors))


class EnqueueTests(OutboxTestCase):
    def test_delivers_and_records(self):
        self.account.default_reply_to = 'office@example.com'
        self.account.save()
        message = self.enqueue()
        message.refresh_from_db()

        self.assertEqual(message.status, Status.SENT)
        self.assertEqual(message.attempts, 1)
        self.assertEqual(message.account, self.account)
        self.assertIsNotNone(message.sent_at)
        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertEqual(sent.to, ['camper@example.com'])
        self.assertEqual(sent.reply_to, ['office@example.com'])
        self.assertEqual(sent.alternatives[0].content, '<p>Hi there</p>')
        self.assertEqual(sent.extra_headers['Message-ID'], message.smtp_message_id)
        self.assertTrue(message.smtp_message_id.endswith('@example.com>'))

    def test_dedupe_key(self):
        first = self.enqueue(dedupe_key='confirmation:1')
        second = self.enqueue(dedupe_key='confirmation:1')
        self.assertEqual(first.id, second.id)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(models.EmailMessage.objects.count(), 1)

    def test_cancelled_dedupe_key_can_be_reused(self):
        first = self.enqueue(dedupe_key='confirmation:1')
        first.status = Status.CANCELLED
        first.save()
        second = self.enqueue(dedupe_key='confirmation:1')
        self.assertNotEqual(first.id, second.id)

    def test_dontsend_address(self):
        message = self.enqueue(to='Test <someone@dontsend.com>')
        self.assertEqual(message.status, Status.CANCELLED)
        self.assertIn('@dontsend.com', message.last_error)
        self.assertEqual(mail.outbox, [])

    def test_invalid_address(self):
        message = self.enqueue(to='not an address')
        self.assertEqual(message.status, Status.FAILED)
        self.assertIn('valid email address', message.last_error)
        self.assertEqual(mail.outbox, [])

    def test_named_address(self):
        message = self.enqueue(to='"Pat Camper" <pat@example.com>')
        message.refresh_from_db()
        self.assertEqual(message.status, Status.SENT)
        self.assertEqual(mail.outbox[0].to, ['"Pat Camper" <pat@example.com>'])

    def test_no_account_uses_default_mailer(self):
        self.event.email_account = None
        self.event.save()
        message = self.enqueue()
        message.refresh_from_db()
        self.assertIsNone(message.account)
        self.assertEqual(message.status, Status.SENT)

    def test_invitation_sent_time(self):
        registration_type = models.RegistrationType.objects.create(
            event=self.event, name='staff', label='Staff')
        invitation = models.Invitation.objects.create(
            registration_type=registration_type, recipient_email='pat@example.com')
        message = self.enqueue(kind=models.EmailMessageKind.INVITATION, invitation=invitation)
        message.refresh_from_db()
        invitation.refresh_from_db()
        self.assertEqual(invitation.sent_time, message.sent_at)


class DeliverTests(OutboxTestCase):
    def test_deliver_twice_sends_once(self):
        message = self.enqueue()
        self.assertEqual(outbox.deliver(message.id), 'skipped')
        self.assertEqual(len(mail.outbox), 1)

    def test_not_due_is_skipped(self):
        with self.flaky(smtplib.SMTPServerDisconnected('gone')):
            message = self.enqueue()
        self.assertEqual(outbox.deliver(message.id), 'skipped')

    def test_temporary_error_is_retried_with_backoff(self):
        with freeze_time(START) as clock, self.flaky(
                smtplib.SMTPServerDisconnected('Connection unexpectedly closed'),
                smtplib.SMTPResponseException(421, b'Try again later')):
            message = self.enqueue()
            message.refresh_from_db()
            self.assertEqual(message.status, Status.QUEUED)
            self.assertEqual(message.attempts, 1)
            self.assertEqual(message.next_attempt_at, START + datetime.timedelta(minutes=1))
            self.assertIn('Connection unexpectedly closed', message.last_error)

            clock.tick(datetime.timedelta(seconds=59))
            self.assertEqual(run_due_tasks(), 0)
            clock.tick(datetime.timedelta(seconds=1))
            self.assertEqual(run_due_tasks(), 1)
            message.refresh_from_db()
            self.assertEqual(message.attempts, 2)
            self.assertEqual(message.next_attempt_at,
                             timezone.now() + datetime.timedelta(minutes=5))
            self.assertIn('421 Try again later', message.last_error)

            clock.tick(datetime.timedelta(minutes=5))
            run_due_tasks()
        message.refresh_from_db()
        self.assertEqual(message.status, Status.SENT)
        self.assertEqual(message.attempts, 3)
        self.assertEqual(message.last_error, '')
        self.assertEqual(len(mail.outbox), 1)

    def test_gives_up_after_the_last_attempt(self):
        errors = [TimeoutError()] * outbox.MAX_ATTEMPTS
        with freeze_time(START) as clock, self.flaky(*errors):
            message = self.enqueue()
            for _ in range(outbox.MAX_ATTEMPTS):
                clock.tick(datetime.timedelta(hours=13))
                run_due_tasks()
        message.refresh_from_db()
        self.assertEqual(message.status, Status.FAILED)
        self.assertEqual(message.attempts, outbox.MAX_ATTEMPTS)
        self.assertIn('Timed out', message.last_error)
        self.assertEqual(mail.outbox, [])

    def test_permanent_errors_fail_at_once(self):
        for error in [
            smtplib.SMTPRecipientsRefused({'camper@example.com': (550, b'No such user')}),
            smtplib.SMTPAuthenticationError(535, b'Bad credentials'),
            AccountUnusable('fix the password'),
        ]:
            with self.subTest(error=error), self.flaky(error):
                message = self.enqueue()
                message.refresh_from_db()
                self.assertEqual(message.status, Status.FAILED)
                self.assertEqual(message.attempts, 1)

    def test_refused_with_4xx_is_retried(self):
        error = smtplib.SMTPRecipientsRefused({'camper@example.com': (451, b'Greylisted')})
        with self.flaky(error):
            message = self.enqueue()
        message.refresh_from_db()
        self.assertEqual(message.status, Status.QUEUED)
        self.assertIn('451 Greylisted', message.last_error)


class ThrottleTests(OutboxTestCase):
    def test_per_minute_limit(self):
        self.account.max_per_minute = 2
        self.account.save()
        with freeze_time(START) as clock:
            self.enqueue(to='a@example.com')
            self.enqueue(to='b@example.com')
            clock.tick(datetime.timedelta(seconds=10))
            third = self.enqueue(to='c@example.com')
            third.refresh_from_db()
            self.assertEqual(third.status, Status.QUEUED)
            self.assertEqual(third.attempts, 0)  # waiting isn't an attempt
            self.assertEqual(third.next_attempt_at, START + datetime.timedelta(minutes=1))
            self.assertEqual(len(mail.outbox), 2)

            clock.tick(datetime.timedelta(seconds=50))
            self.assertEqual(run_due_tasks(), 1)
        third.refresh_from_db()
        self.assertEqual(third.status, Status.SENT)
        self.assertEqual(third.attempts, 1)
        self.assertEqual(len(mail.outbox), 3)

    def test_daily_limit(self):
        self.account.max_per_day = 1
        self.account.save()
        with freeze_time(START) as clock:
            self.enqueue(to='a@example.com')
            clock.tick(datetime.timedelta(hours=3))
            later = self.enqueue(to='b@example.com')
            later.refresh_from_db()
            self.assertEqual(later.next_attempt_at, START + datetime.timedelta(days=1))
            clock.tick(datetime.timedelta(hours=21))
            run_due_tasks()
        later.refresh_from_db()
        self.assertEqual(later.status, Status.SENT)

    def test_limits_are_per_account(self):
        self.account.max_per_minute = 1
        self.account.save()
        other = models.EmailAccount.objects.create(
            organization=self.organization, name='other', host='smtp.example.com',
            port=587, max_per_minute=1)
        self.enqueue(to='a@example.com')
        message = self.enqueue(to='b@example.com', account=other)
        message.refresh_from_db()
        self.assertEqual(message.status, Status.SENT)

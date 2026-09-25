import os

from cryptography.fernet import Fernet
from django.core import mail
from django.core.mail import EmailMultiAlternatives
from django.db import connection as db_connection
from django.test import TestCase, override_settings
import django.core.mail.backends.console
import django.core.mail.backends.locmem
import django.core.mail.backends.smtp

from camphoric import models
from camphoric.mail import (
    get_email_connection_for_event,
    send_bulk_email,
    cancel_bulk_email,
)
from camphoric.mail.mailers import AccountUnusable, mailer_for


@override_settings(CAMPHORIC_EMAIL_FORCE_BACKEND='')
class MailerTests(TestCase):
    def setUp(self):
        self.organization = models.Organization.objects.create(name='Test Organization')

    def create_account(self, **kwargs):
        fields = dict(
            organization=self.organization,
            name='test account',
            backend='django.core.mail.backends.smtp.EmailBackend',
            host='smtp.example.com',
            port=587,
            username='user@example.com',
            password='abc123',
        )
        return models.EmailAccount.objects.create(**{**fields, **kwargs})

    def test_email_connection_for_event_no_account(self):
        event = models.Event.objects.create(organization=self.organization)
        connection = get_email_connection_for_event(event)
        self.assertIsInstance(connection, django.core.mail.backends.locmem.EmailBackend)

    def test_smtp_account(self):
        account = models.EmailAccount.objects.get(id=self.create_account().id)
        connection = mailer_for(account)
        self.assertIsInstance(connection, django.core.mail.backends.smtp.EmailBackend)
        self.assertEqual(connection.host, 'smtp.example.com')
        self.assertEqual(connection.port, 587)
        self.assertEqual(connection.username, 'user@example.com')
        self.assertEqual(connection.password, 'abc123')
        self.assertTrue(connection.use_tls)
        self.assertFalse(connection.use_ssl)
        self.assertEqual(connection.timeout, 30)

    def test_ssl_account(self):
        account = self.create_account(security='ssl', port=465, timeout=10)
        connection = mailer_for(account)
        self.assertFalse(connection.use_tls)
        self.assertTrue(connection.use_ssl)
        self.assertEqual(connection.timeout, 10)

    def test_console_account(self):
        account = self.create_account(backend='django.core.mail.backends.console.EmailBackend')
        self.assertIsInstance(mailer_for(account), django.core.mail.backends.console.EmailBackend)

    def test_password_is_stored_encrypted(self):
        account = self.create_account()
        with db_connection.cursor() as cursor:
            cursor.execute('SELECT password FROM camphoric_emailaccount WHERE id = %s',
                           [account.id])
            stored = cursor.fetchone()[0]
        self.assertTrue(stored.startswith('fernet:'))
        self.assertNotIn('abc123', stored)
        self.assertEqual(models.EmailAccount.objects.get(id=account.id).password, 'abc123')

    def test_unreadable_password(self):
        account = self.create_account()
        with override_settings(CAMPHORIC_SECRET_KEY_EMAIL=Fernet.generate_key().decode()):
            account = models.EmailAccount.objects.get(id=account.id)
            self.assertIsNone(account.password)
            with self.assertRaises(AccountUnusable):
                mailer_for(account)

    @override_settings(
        CAMPHORIC_EMAIL_FORCE_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_forced_backend(self):
        self.assertIsInstance(mailer_for(self.create_account()),
                              django.core.mail.backends.locmem.EmailBackend)


class BulkEmailTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.organization = models.Organization.objects.create(name='Test Organization')
        cls.event = models.Event.objects.create(organization=cls.organization)

    def setUp(self):
        self.real_send = EmailMultiAlternatives.send
        self.real_attach_alternative = EmailMultiAlternatives.attach_alternative

    def tearDown(self):
        EmailMultiAlternatives.send = self.real_send
        EmailMultiAlternatives.attach_alternative = self.real_attach_alternative

    def create_task(self, recipients=None, **kwargs):
        # The send machinery, with the lightest renderer: these tests time sends.
        kwargs.setdefault('engine', models.TemplateEngine.MUSTACHE)
        task = models.BulkEmailTask.objects.create(
            event=self.event,
            from_email='registration@example.com',
            subject='Hi, everyone!',
            body_template='Hi {{recipient.email}}',
            **kwargs)
        if recipients is None:
            recipients = [models.BulkEmailRecipient(email=email) for email in [
                'alex@example.com', 'bob@example.com', 'chris@example.com'
            ]]
        for recipient in recipients:
            task.recipients.add(recipient, bulk=False)

        return task

    def test_empty_list(self):
        task = self.create_task(recipients=[])
        send_bulk_email(task)
        self.assertEqual(len(mail.outbox), 0)
        self.assertIsNone(task.running_pid)

    def test_success(self):
        task = self.create_task()
        send_spy_data = {}

        def send_spy(*args, **kwargs):
            send_spy_data['running_pid'] = task.running_pid
            return self.real_send(*args, **kwargs)
        EmailMultiAlternatives.send = send_spy

        send_bulk_email(task)

        self.assertEqual(send_spy_data['running_pid'], os.getpid())
        self.assertIsNone(task.running_pid)
        self.assertIsNotNone(task.run_start_time)
        self.assertIsNotNone(task.run_finish_time)
        self.assertIsNone(task.error)
        for recipient in task.recipients.all():
            self.assertIsNotNone(recipient.sent_time)
            self.assertIsNone(recipient.error)
        self.assertEqual(len(mail.outbox), 3)
        for recipient, message in zip(task.recipients.all(), mail.outbox):
            self.assertEqual(message.to, [recipient.email])
            self.assertEqual(message.subject, 'Hi, everyone!')
            self.assertEqual(message.body, f'Hi {recipient.email}')
            self.assertEqual(message.alternatives, [(
                f'<p>Hi <a href="mailto:{recipient.email}">{recipient.email}</a></p>\n',
                'text/html'
            )])

    def test_cancel_resume(self):
        task = self.create_task()
        task_id = task.id

        def send_spy(*args, **kwargs):
            task = models.BulkEmailTask.objects.get(id=task_id)
            cancel_bulk_email(task)
            return self.real_send(*args, **kwargs)
        EmailMultiAlternatives.send = send_spy

        send_bulk_email(task)

        self.assertIsNone(task.running_pid)
        self.assertIsNotNone(task.run_start_time)
        self.assertIsNone(task.run_finish_time)
        self.assertIsNone(task.error)
        (alex, bob, chris) = task.recipients.all()
        self.assertIsNotNone(alex.sent_time)
        self.assertIsNone(bob.sent_time)
        self.assertIsNone(chris.sent_time)
        self.assertEqual(len(mail.outbox), 1)

        EmailMultiAlternatives.send = self.real_send

        send_bulk_email(task)

        self.assertIsNotNone(task.run_finish_time)
        (alex, bob, chris) = task.recipients.all()
        self.assertIsNotNone(bob.sent_time)
        self.assertIsNotNone(chris.sent_time)
        self.assertEqual(len(mail.outbox), 3)

    def test_send_error(self):
        task = self.create_task()

        def send_spy(message, *args, **kwargs):
            if message.to == ['bob@example.com']:
                raise RuntimeError('derp')
            return self.real_send(message, *args, **kwargs)
        EmailMultiAlternatives.send = send_spy

        with self.assertLogs(level='ERROR'):
            send_bulk_email(task)

        self.assertIsNone(task.running_pid)
        self.assertIsNotNone(task.run_start_time)
        self.assertIsNotNone(task.run_finish_time)
        self.assertIsNone(task.error)
        (alex, bob, chris) = task.recipients.all()
        self.assertIsNotNone(alex.sent_time)
        self.assertIsNone(bob.sent_time)
        self.assertEqual(bob.error, 'derp')
        self.assertIsNotNone(chris.sent_time)
        self.assertEqual(len(mail.outbox), 2)

    def test_non_send_error(self):
        task = self.create_task()

        def throw(*args, **kwargs):
            raise RuntimeError('derp')
        EmailMultiAlternatives.attach_alternative = throw

        with self.assertRaises(RuntimeError):
            send_bulk_email(task)

        self.assertIsNone(task.running_pid)
        self.assertIsNotNone(task.run_start_time)
        self.assertIsNone(task.run_finish_time)
        self.assertEqual(task.error, 'derp')
        self.assertEqual(len(mail.outbox), 0)

    def test_interrupt(self):
        # Test that calling send_bulk_email on a task that's already running
        # (i.e. in a different worker process or thread) will cancel the current
        # run and start a new one. In this case, since a message is currently
        # being sent when the task is run a second time, that message will be
        # sent by both tasks. This isn't ideal but probably acceptable.

        task = self.create_task()
        task_id = task.id
        send_calls = 0

        def send_spy(message, *args, **kwargs):
            nonlocal send_calls
            send_calls += 1
            if send_calls == 2:
                task = models.BulkEmailTask.objects.get(id=task_id)
                send_bulk_email(task)
            return self.real_send(message, *args, **kwargs)
        EmailMultiAlternatives.send = send_spy

        send_bulk_email(task)

        self.assertEqual(
            [m.to[0] for m in mail.outbox],
            [
                # run 1 starts
                'alex@example.com',   # run 1 sent to alex
                # run 1 starts sending to bob
                # run 2 starts
                'bob@example.com',    # run 2 sent to bob
                'chris@example.com',  # run 2 sent to chris
                # run 2 finishes
                'bob@example.com',    # run 1 finishes sending to bob
                # run 1 returns early because run 2 took over
            ],
        )

    def test_messages_per_second(self):
        task = self.create_task(messages_per_second=10)

        send_bulk_email(task)

        # sent_time is stamped after each send and save, so it jitters with that
        # work; the pacing guarantees the gaps are never shorter than 1/rate.
        (alex, bob, chris) = task.recipients.all()
        for gap in (bob.sent_time - alex.sent_time, chris.sent_time - bob.sent_time):
            self.assertGreaterEqual(gap.total_seconds(), 0.09)
            self.assertLess(gap.total_seconds(), 0.2)

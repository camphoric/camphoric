from cryptography.fernet import Fernet
from django.db import connection as db_connection
from django.test import TestCase, override_settings
import django.core.mail.backends.console
import django.core.mail.backends.locmem
import django.core.mail.backends.smtp

from camphoric import models
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

    def test_no_account_uses_the_default_mailer(self):
        self.assertIsInstance(mailer_for(None), django.core.mail.backends.locmem.EmailBackend)

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

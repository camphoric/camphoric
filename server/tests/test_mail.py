from django.test import TestCase
import django.core.mail.backends.console
import django.core.mail.backends.locmem
import django.core.mail.backends.smtp

from camphoric import models
from camphoric.mail import get_email_connection_for_event


class MailTests(TestCase):
    def setUp(self):
        self.organization = models.Organization.objects.create(name='Test Organization')

    def test_email_connection_for_event_no_account(self):
        event = models.Event.objects.create(organization=self.organization)
        connection = get_email_connection_for_event(event)
        self.assertIsInstance(connection, django.core.mail.backends.locmem.EmailBackend)

    def test_email_connection_for_event_smtp(self):
        account = models.EmailAccount.objects.create(
            organization=self.organization,
            name='test account',
            backend='django.core.mail.backends.smtp.EmailBackend',
            host='smtp.example.com',
            port=587,
            username='user@example.com',
            password='abc123',
        )
        event = models.Event.objects.create(
            organization=self.organization,
            email_account=account,
        )
        connection = get_email_connection_for_event(event)
        self.assertIsInstance(connection, django.core.mail.backends.smtp.EmailBackend)
        self.assertEquals(connection.host, 'smtp.example.com')
        self.assertEquals(connection.port, 587)
        self.assertEquals(connection.username, 'user@example.com')
        self.assertEquals(connection.password, 'abc123')

    def test_email_connection_for_event_console(self):
        account = models.EmailAccount.objects.create(
            organization=self.organization,
            name='test account',
            backend='django.core.mail.backends.console.EmailBackend',
            host='placeholder.example.com',
            port=1,
            username='placeholder@example.com',
            password='placeholder',
        )
        event = models.Event.objects.create(
            organization=self.organization,
            email_account=account,
        )
        connection = get_email_connection_for_event(event)
        self.assertIsInstance(connection, django.core.mail.backends.console.EmailBackend)

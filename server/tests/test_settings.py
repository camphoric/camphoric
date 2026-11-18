'''
The security settings' defaults (settings_default.py), worked out from the
environment: Secure cookies and HSTS unless DEBUG is on, no SSL redirect.
'''

import importlib.util
import os
from unittest import mock

from dbbackup.db.base import get_connector
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from camphoric import models
import camphoric_server.settings_default

REQUIRED = {
    'SECRET_KEY': 'test-only',
    'DATABASE_URL': 'postgres://camphoric@localhost/camphoric',
    'PAYPAL_BASE_URL': 'https://api-m.sandbox.paypal.com',
    'PAYPAL_SECRET': 'test-only',
    'ENV_PATH': '/nonexistent/.env',  # no .env file: only what each test gives
}


def settings_with(**env):
    '''A fresh copy of settings_default, read from just this environment.'''
    spec = importlib.util.spec_from_file_location(
        'settings_under_test', camphoric_server.settings_default.__file__)
    module = importlib.util.module_from_spec(spec)
    with mock.patch.dict(os.environ, {**REQUIRED, **env}, clear=True):
        spec.loader.exec_module(module)
    return module


class SecuritySettingsTests(SimpleTestCase):
    def test_production_defaults(self):
        settings = settings_with()
        self.assertTrue(settings.SESSION_COOKIE_SECURE)
        self.assertTrue(settings.SESSION_COOKIE_HTTPONLY)
        self.assertTrue(settings.CSRF_COOKIE_SECURE)
        self.assertEqual(settings.SECURE_HSTS_SECONDS, 3600)
        # TLS usually ends at a proxy, which redirects itself.
        self.assertFalse(settings.SECURE_SSL_REDIRECT)

    def test_debug_defaults(self):
        settings = settings_with(DEBUG='on')
        self.assertFalse(settings.CSRF_COOKIE_SECURE)
        self.assertEqual(settings.SECURE_HSTS_SECONDS, 0)

    def test_plain_http_turns_off_both_cookies_secure(self):
        settings = settings_with(SESSION_COOKIE_SECURE='false')
        self.assertFalse(settings.CSRF_COOKIE_SECURE)

    def test_each_can_be_set(self):
        settings = settings_with(DEBUG='on', CSRF_COOKIE_SECURE='true',
                                 SECURE_HSTS_SECONDS='31536000', SECURE_SSL_REDIRECT='true')
        self.assertTrue(settings.CSRF_COOKIE_SECURE)
        self.assertEqual(settings.SECURE_HSTS_SECONDS, 31536000)
        self.assertTrue(settings.SECURE_SSL_REDIRECT)


class TrustedOriginsTests(SimpleTestCase):
    def test_the_public_sites_origin_is_trusted_with_the_dev_servers(self):
        # A compose stack whose frontend is published on another port.
        settings = settings_with(CAMPHORIC_PUBLIC_URL='http://localhost:13000/')
        self.assertIn('http://localhost:13000', settings.CSRF_TRUSTED_ORIGINS)
        self.assertIn('http://localhost:3000', settings.CSRF_TRUSTED_ORIGINS)

    def test_a_public_url_with_a_path_is_trusted_by_its_origin(self):
        settings = settings_with(CAMPHORIC_PUBLIC_URL='https://register.example.org/camp/')
        self.assertIn('https://register.example.org', settings.CSRF_TRUSTED_ORIGINS)

    def test_the_origin_is_the_one_a_browser_sends(self):
        for url, origin in (('HTTPS://Register.Example.org', 'https://register.example.org'),
                            ('https://register.example.org:443/', 'https://register.example.org'),
                            ('http://user@127.0.0.1:13000', 'http://127.0.0.1:13000'),
                            ('http://[::1]:13000/', 'http://[::1]:13000')):
            with self.subTest(url=url):
                settings = settings_with(CAMPHORIC_PUBLIC_URL=url)
                self.assertEqual(settings.CSRF_TRUSTED_ORIGINS[-1], origin)

    def test_a_malformed_public_url_adds_nothing(self):
        for url in ('http://[::1', 'localhost:13000', 'register.example.org'):
            with self.subTest(url=url):
                settings = settings_with(CAMPHORIC_PUBLIC_URL=url)
                self.assertEqual(settings.CSRF_TRUSTED_ORIGINS, settings._DEV_ORIGINS)

    def test_a_dev_servers_origin_is_listed_once(self):
        settings = settings_with(CAMPHORIC_PUBLIC_URL='http://localhost:3000')
        self.assertEqual(settings.CSRF_TRUSTED_ORIGINS.count('http://localhost:3000'), 1)

    def test_without_a_public_url_only_the_dev_servers_are_trusted(self):
        settings = settings_with()
        self.assertEqual(settings.CSRF_TRUSTED_ORIGINS, settings._DEV_ORIGINS)

    def test_the_environment_replaces_the_list(self):
        settings = settings_with(CAMPHORIC_PUBLIC_URL='http://localhost:13000',
                                 CSRF_TRUSTED_ORIGINS='https://register.example.org')
        self.assertEqual(settings.CSRF_TRUSTED_ORIGINS, ['https://register.example.org'])


class RetentionSettingTests(SimpleTestCase):
    def test_incomplete_registrations_are_kept_thirty_days_by_default(self):
        self.assertEqual(settings_with().CAMPHORIC_INCOMPLETE_RETENTION_DAYS, 30)

    def test_the_environment_sets_it(self):
        settings = settings_with(CAMPHORIC_INCOMPLETE_RETENTION_DAYS='7')
        self.assertEqual(settings.CAMPHORIC_INCOMPLETE_RETENTION_DAYS, 7)

    def test_it_must_be_a_sensible_number_of_days(self):
        for value, error in (('0', ImproperlyConfigured), ('-1', ImproperlyConfigured),
                             ('99999999', ImproperlyConfigured), ('soon', ValueError)):
            with self.subTest(value=value), self.assertRaises(error):
                settings_with(CAMPHORIC_INCOMPLETE_RETENTION_DAYS=value)


class BackupSettingsTests(SimpleTestCase):
    def test_registration_drafts_are_left_out_of_a_dump(self):
        connector = get_connector('default')
        table = models.RegistrationDraft._meta.db_table
        self.assertIn(table, connector.exclude)
        with mock.patch.object(connector, 'run_command', return_value=(None, None)) as run:
            connector._create_dump()
        self.assertIn(f'--exclude-table-data={table}', run.call_args.args[0])

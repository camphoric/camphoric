'''
The security settings' defaults (settings_default.py), worked out from the
environment: Secure cookies and HSTS unless DEBUG is on, no SSL redirect.
'''

import importlib.util
import os
from unittest import mock

from django.test import SimpleTestCase

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

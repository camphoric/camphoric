# This file is here so you can override the default settings as needed

from camphoric_server.settings_default import *  # noqa: F403 F401

CSRF_TRUSTED_ORIGINS = [
    'http://localhost:8000',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://django:8000/',
]
ALLOWED_HOSTS = [
    'localhost',
    'django',
]
CORS_ORIGIN_WHITELIST = [
    'http://localhost:8000',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://django:8000/',
]

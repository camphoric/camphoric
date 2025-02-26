# This file is here so you can override the default settings as needed

from camphoric_server.settings_default import *  # noqa: F403 F401

CSRF_TRUSTED_ORIGINS = [
    'https://localhost',
    'http://NXDOMAIN:8000',
    'http://NXDOMAIN:3000',
    'http://localhost:8000',
    'http://localhost:3000',
]
ALLOWED_HOSTS = [
    'localhost',
    'NXDOMAIN',
    'localhost',
]
CORS_ORIGIN_WHITELIST = [
    'https://localhost',
    'http://NXDOMAIN:8000',
    'http://NXDOMAIN:3000',
    'http://localhost:8000',
    'http://localhost:3000',
]

# Backup
# https://django-dbbackup.readthedocs.io/en/master/index.html
DBBACKUP_STORAGE = env(
    'DBBACKUP_STORAGE',
    default='django.core.files.storage.FileSystemStorage'
)
DBBACKUP_STORAGE_OPTIONS = env.json(
    'DBBACKUP_STORAGE_OPTIONS',
    default={'location': '/home/vagrant/camphoric/server/backup/'}
)



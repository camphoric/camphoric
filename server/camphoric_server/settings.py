# This file is here so you can override the default settings as needed

from camphoric_server.settings_default import *  # noqa: F403 F401

CSRF_TRUSTED_ORIGINS = [
    'https://localhost',
    'http://NXDOMAIN:8000',
    'http://NXDOMAIN:3000',
    'http://localhost:8000',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',

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
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
]

# Backup
# https://django-dbbackup.readthedocs.io/en/master/index.html
DBBACKUP_STORAGE = env(  # noqa: F405
    'DBBACKUP_STORAGE',
    default='django.core.files.storage.FileSystemStorage'
)
DBBACKUP_STORAGE_OPTIONS = env.json(  # noqa: F405
    'DBBACKUP_STORAGE_OPTIONS',
    default={'location': '/home/vagrant/camphoric/server/backup/'}
)

try:
    from camphoric_server.settings_override import *  # noqa: F403 F401
except ImportError:
    pass

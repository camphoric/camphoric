"""
Django settings for camphoric_server project.

Generated by 'django-admin startproject' using Django 2.2.5.

For more information on this file, see
https://docs.djangoproject.com/en/2.2/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/2.2/ref/settings/
"""

import os
import django_heroku
import environ
import mimetypes

mimetypes.add_type("text/css", ".css", True)
mimetypes.add_type("application/x-javascript", ".js", True)
mimetypes.add_type("image/jpeg", ".jpg", True)
mimetypes.add_type("image/jpeg", ".jpeg", True)

# read .env file
env = environ.Env(
    DEBUG=(bool, False)
)
environ.Env.read_env(env.str('ENV_PATH', '.env/local/django'))


# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/2.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env('DEBUG')

ALLOWED_HOSTS = []

# TODO: https://github.com/camphoric/camphoric/issues/185
STATIC_URL = '/static/'

# Application definition

INSTALLED_APPS = [
    'camphoric.apps.CamphoricConfig',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'frontend_bootstrap',
    'dbbackup',  # django-dbbackup
    'django_filters',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'camphoric_server.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'camphoric_server.wsgi.application'


# Database
# https://docs.djangoproject.com/en/2.2/ref/settings/#databases

DATABASES = {
    # read os.environ['DATABASE_URL'] and raises ImproperlyConfigured exception if not found
    'default': env.db(),
}

DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'


EMAIL_BACKEND = env('EMAIL_BACKEND', default='django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = env('EMAIL_HOST', default=None)
EMAIL_PORT = env('EMAIL_PORT', default=None)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default=None)
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default=None)
EMAIL_USE_TLS = env('EMAIL_USE_TLS', default=True)
EMAIL_USE_SSL = env('EMAIL_USE_SSL', default=False)
EMAIL_TIMEOUT = env('EMAIL_TIMEOUT', default=30)


# Password validation
# https://docs.djangoproject.com/en/2.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/2.2/topics/i18n/
# Figure out time represention naive vs aware

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_L10N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/2.2/howto/static-files/

REACT_BUILD_DIR = os.path.join(BASE_DIR, "frontend_bootstrap/build")

# TODO: https://github.com/camphoric/camphoric/issues/185
STATICFILES_DIRS = [
    os.path.join(REACT_BUILD_DIR, 'static'),
]

WHITENOISE_ROOT = os.path.join(REACT_BUILD_DIR)

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
    ],
}

SESSION_COOKIE_SECURE = True

PAYPAL_BASE_URL = env('PAYPAL_BASE_URL')
PAYPAL_SECRET = env('PAYPAL_SECRET')

django_heroku.settings(locals(), databases=not DEBUG)

# Backup
# https://django-dbbackup.readthedocs.io/en/master/index.html
DBBACKUP_STORAGE = env(
    'DBBACKUP_STORAGE',
    default='django.core.files.storage.FileSystemStorage'
)
DBBACKUP_STORAGE_OPTIONS = env.json(
    'DBBACKUP_STORAGE_OPTIONS',
    default={'location': '/app/backup/'}
)

CSRF_TRUSTED_ORIGINS = ['http://localhost:8000/', 'http://django:8000/']

# Allow PayPal Popup
SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin-allow-popups'

# See http://docs.djangoproject.com/en/dev/topics/logging for
# more details on how to customize your logging configuration.
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'logfile': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse',
        },
        'require_debug_true': {
            '()': 'django.utils.log.RequireDebugTrue',
        },
    },
    'handlers': {
        'console': {
            'level': 'DEBUG',
            'filters': ['require_debug_true'],
            'class': 'logging.StreamHandler',
            'formatter': 'simple'
        },
        'mail_admins': {
            'level': 'ERROR',
            'formatter': 'verbose',
            'filters': ['require_debug_false'],
            'class': 'django.utils.log.AdminEmailHandler',
        },
        'applogfile': {
            'level': 'INFO',
            'formatter': 'logfile',
            'class': 'logging.handlers.RotatingFileHandler',
            'filters': ['require_debug_false'],
            'filename': os.path.join(BASE_DIR, 'camphoric.log'),
            'maxBytes': 1024*1024*15,  # 15MB
            'backupCount': 10,
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'DEBUG',
    },
    'loggers': {
        'django': {
            'handlers': ['applogfile'],
            'propagate': True,
        },
    },
}

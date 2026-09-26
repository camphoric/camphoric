'''
Deployment checks for account email (SPEC DR-52), run by `manage.py check`.
'''

from django.conf import settings
from django.core.checks import Tags, Warning, register


@register(Tags.security, deploy=True)
def password_links(app_configs, **kwargs):
    problems = []
    if '*' in settings.ALLOWED_HOSTS and not getattr(settings, 'CAMPHORIC_PUBLIC_URL', ''):
        problems.append(Warning(
            'ALLOWED_HOSTS allows any host and CAMPHORIC_PUBLIC_URL is empty, so a '
            'password-reset request could make the emailed link point at another site.',
            hint='Set CAMPHORIC_PUBLIC_URL to the site\'s address.',
            id='camphoric.W001'))
    smtp = settings.MAILERS['default']['BACKEND'] == 'django.core.mail.backends.smtp.EmailBackend'
    if smtp and settings.DEFAULT_FROM_EMAIL.endswith('@localhost'):
        problems.append(Warning(
            f'Account email comes from {settings.DEFAULT_FROM_EMAIL}, which mail servers '
            'usually refuse.',
            hint='Set DEFAULT_FROM_EMAIL to a real address.',
            id='camphoric.W002'))
    return problems

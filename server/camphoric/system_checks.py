'''
Deployment checks for account email (SPEC DR-52), run by `manage.py check`.
'''

from django.conf import settings
from django.core.checks import Tags, Warning, register


@register(Tags.security, deploy=True)
def password_links(app_configs, **kwargs):
    problems = []
    if not getattr(settings, 'CAMPHORIC_PUBLIC_URL', ''):
        problems.append(Warning(
            'CAMPHORIC_PUBLIC_URL is empty, so no set-password or password-reset link can '
            'be made, and organizers\' reports leave out their admin links.',
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

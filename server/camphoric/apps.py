from django.apps import AppConfig


class CamphoricConfig(AppConfig):
    name = 'camphoric'

    def ready(self):
        # system_checks registers the checks; throttles counts failed sign-ins;
        # accounts, api_tokens and oauth end credentials when a password changes or a
        # user is deactivated, in any process (manage.py changepassword loads no URLs).
        from camphoric import (  # noqa: F401
            accounts, api_tokens, audit, live, oauth, system_checks, throttles)
        audit.register_models()
        live.connect()

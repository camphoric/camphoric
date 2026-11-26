from django.apps import AppConfig


class CamphoricConfig(AppConfig):
    name = 'camphoric'

    def ready(self):
        # system_checks registers the checks; throttles counts failed sign-ins;
        # accounts, api_tokens and oauth end credentials when a password changes or a
        # user is deactivated, in any process (manage.py changepassword loads no URLs);
        # multi_event.people dissolves a person whose camper records are deleted.
        from camphoric import (  # noqa: F401
            accounts, api_tokens, audit, live, oauth, system_checks, throttles)
        from camphoric.multi_event import people  # noqa: F401
        audit.register_models()
        live.connect()

from django.apps import AppConfig


class CamphoricConfig(AppConfig):
    name = 'camphoric'

    def ready(self):
        # system_checks registers the checks; throttles counts failed sign-ins;
        # accounts and oauth end credentials when a password changes or a user is
        # deactivated, in any process (manage.py changepassword loads no URLs).
        from camphoric import accounts, audit, live, oauth, system_checks, throttles  # noqa: F401
        audit.register_models()
        live.connect()

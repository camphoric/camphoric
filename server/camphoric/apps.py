from django.apps import AppConfig


class CamphoricConfig(AppConfig):
    name = 'camphoric'

    def ready(self):
        # system_checks registers the checks; throttles counts failed sign-ins
        from camphoric import audit, live, system_checks, throttles  # noqa: F401
        audit.register_models()
        live.connect()

from django.apps import AppConfig


class CamphoricConfig(AppConfig):
    name = 'camphoric'

    def ready(self):
        from camphoric import system_checks  # noqa: F401 (registers the checks)

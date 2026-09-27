import logging
import os

from django.test.runner import DiscoverRunner
from django.test.utils import override_settings


class CamphoricTestRunner(DiscoverRunner):
    '''
    Runs tasks as they're queued (camphoric.test.tasks), so queued email is
    delivered straight into django.core.mail.outbox, and sends every account's
    mail there instead of to its server.

    Keeps log messages out of the test output: many tests deliberately take the
    paths that log (refused requests, failing mail servers, broken templates),
    and a failing test reports itself. Set CAMPHORIC_TEST_LOG_LEVEL (e.g.
    `CAMPHORIC_TEST_LOG_LEVEL=DEBUG python manage.py test tests.test_outbox`) to
    see them while debugging. Loggers are left alone, so `assertLogs` still works.
    '''

    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        self._camphoric_settings = override_settings(
            TASKS={'default': {
                'BACKEND': 'camphoric.test.tasks.EagerTaskBackend',
                'QUEUES': ['email', 'default'],
            }},
            CAMPHORIC_EMAIL_FORCE_BACKEND='django.core.mail.backends.locmem.EmailBackend',
        )
        self._camphoric_settings.enable()
        # Every task logs its start and finish at INFO; too noisy for test output.
        logging.getLogger('django.tasks').setLevel(logging.WARNING)
        level = os.environ.get('CAMPHORIC_TEST_LOG_LEVEL', 'CRITICAL').upper()
        self._console_levels = [
            (handler, handler.level) for handler in logging.getLogger().handlers]
        for handler, _ in self._console_levels:
            handler.setLevel(level)

    def teardown_test_environment(self, **kwargs):
        for handler, level in self._console_levels:
            handler.setLevel(level)
        self._camphoric_settings.disable()
        super().teardown_test_environment(**kwargs)

import logging
import os
import unittest

from django.core.cache import caches
from django.test.runner import (
    DiscoverRunner, ParallelTestSuite, RemoteTestResult, RemoteTestRunner)
from django.test.utils import override_settings


class ClearCachesResult:
    '''
    A test result mixin that empties the caches as each test starts, so one
    test's requests don't count toward the next one's throttles (the API's
    per-client rate limits keep their counts in the default cache).
    '''

    def startTest(self, test):
        for cache in caches.all(initialized_only=True):
            cache.clear()
        super().startTest(test)


class ClearCachesRemoteResult(ClearCachesResult, RemoteTestResult):
    pass


class ClearCachesRemoteRunner(RemoteTestRunner):
    resultclass = ClearCachesRemoteResult


class ClearCachesParallelSuite(ParallelTestSuite):
    # With --parallel, each worker process runs its tests with this runner.
    runner_class = ClearCachesRemoteRunner


class CamphoricTestRunner(DiscoverRunner):
    '''
    Runs tasks as they're queued (camphoric.test.tasks), so queued email is
    delivered straight into django.core.mail.outbox, and sends every account's
    mail there instead of to its server. CAMPHORIC_PUBLIC_URL starts empty, as in
    CI, whatever the development environment sets; tests that need it set it.

    Keeps log messages out of the test output: many tests deliberately take the
    paths that log (refused requests, failing mail servers, broken templates),
    and a failing test reports itself. Set CAMPHORIC_TEST_LOG_LEVEL (e.g.
    `CAMPHORIC_TEST_LOG_LEVEL=DEBUG python manage.py test tests.test_outbox`) to
    see them while debugging. Loggers are left alone, so `assertLogs` still works.

    Starts every test with empty caches (ClearCachesResult).
    '''
    parallel_test_suite = ClearCachesParallelSuite

    def get_resultclass(self):
        base = super().get_resultclass() or unittest.TextTestResult
        return type('ClearCaches' + base.__name__, (ClearCachesResult, base), {})

    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        self._camphoric_settings = override_settings(
            TASKS={'default': {
                'BACKEND': 'camphoric.test.tasks.EagerTaskBackend',
                'QUEUES': ['email', 'default'],
            }},
            CAMPHORIC_EMAIL_FORCE_BACKEND='django.core.mail.backends.locmem.EmailBackend',
            CAMPHORIC_PUBLIC_URL='',
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

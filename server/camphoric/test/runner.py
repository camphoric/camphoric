import logging

from django.test.runner import DiscoverRunner
from django.test.utils import override_settings


class CamphoricTestRunner(DiscoverRunner):
    '''
    Runs tasks as they're queued (camphoric.test.tasks), so queued email is
    delivered straight into django.core.mail.outbox, and sends every account's
    mail there instead of to its server.
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

    def teardown_test_environment(self, **kwargs):
        self._camphoric_settings.disable()
        super().teardown_test_environment(**kwargs)

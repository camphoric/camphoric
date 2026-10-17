'''
The legacy reports under data/events/ still work in the sandboxed legacy environment
(DR-37): every one parses, and each renders exactly as it did in the old,
unsandboxed environment against the same (small) set of posted variables.
Sample Camp (data/events/sample-camp) keeps legacy reports here that use the
legacy environment's extensions and filters ({% do %}, {% continue %},
regex_replace, money_fmt; {% break %} is only parsed), whichever camps'
reports are in the repository.
'''

from pathlib import Path
import unittest

from django.conf import settings
from django.test import SimpleTestCase
from jinja2 import BaseLoader, Environment

from camphoric.pricing import money_fmt
from camphoric.templating.env import LEGACY_REPORT_ENV
from camphoric.templating.filters import regex_replace

DATA_DIR = Path(settings.BASE_DIR).parent / 'data'
EVENTS_DIR = DATA_DIR / 'events'
REPORTS = sorted(EVENTS_DIR.glob('*/reports/*.j2'))


def old_environment():
    env = Environment(extensions=['jinja2.ext.do', 'jinja2.ext.loopcontrols'],
                      loader=BaseLoader())
    env.filters['regex_replace'] = regex_replace
    env.filters['money_fmt'] = money_fmt
    return env


def bundle():
    '''A tiny legacy variable bundle in the client's shape.'''
    root = {'id': 1, 'name': 'Camp', 'parent': None, 'pathParts': [], 'fullPath': '',
            'children': [], 'campers': [], 'capacity': 0}
    cabin = {'id': 2, 'name': 'Cabin', 'parent': 1, 'pathParts': ['Cabin'], 'fullPath': 'Cabin',
             'children': [], 'campers': [], 'capacity': 4}
    root['children'] = [cabin]
    registration = {
        'id': 10, 'registrant_email': 'pat@example.com', 'registration_type': None,
        'created_at': '2026-10-01T12:00:00.000000Z', 'attributes': {},
        'server_pricing_results': {'total': 100}, 'total_owed': 100, 'total_payments': 0,
        'total_balance': 100, 'campers': [], 'payment_type': 'Check',
    }
    camper = {'id': 20, 'registration': 10, 'lodging': 2, 'sequence': 0,
              'stay': ['2026-12-30'], 'attributes': {'first_name': 'Pat', 'last_name': 'A'},
              'admin_attributes': {}, 'server_pricing_results': {'total': 100}}
    registration['campers'] = [camper]
    # A camper with no answers yet, so reports' branches for one run too
    unnamed = {'id': 21, 'registration': 10, 'lodging': None, 'sequence': 1, 'stay': [],
               'attributes': {}, 'admin_attributes': {}, 'server_pricing_results': {}}
    return {
        'event': {'id': 1, 'name': 'Camp', 'registration_end': '2026-12-15'},
        'campers': [camper, unnamed],
        'registrations': [registration],
        'camperLookup': {'20': camper, '21': unnamed},
        'registrationLookup': {'10': registration},
        'lodgingLookup': {'1': root, '2': cabin},
        'registrationTypeLookup': {},
    }


def outcome(env, source):
    try:
        return ('ok', env.from_string(source).render(**bundle()))
    except Exception as exc:  # compare failures too: same kind of failure either way
        return ('error', type(exc).__name__)


@unittest.skipUnless(EVENTS_DIR.is_dir(), 'data/events/ not available')
class LegacyReportsFoundTests(SimpleTestCase):
    def test_the_event_reports_are_found(self):
        # The tests below skip without reports, so a move of the event packages
        # must not quietly turn them off.
        self.assertTrue(REPORTS, f'no reports match {EVENTS_DIR}/*/reports/*.j2')


@unittest.skipUnless(REPORTS, 'data/events/ reports not available')
class LegacyReportTests(SimpleTestCase):
    def test_every_report_parses(self):
        for path in REPORTS:
            with self.subTest(report=str(path.relative_to(DATA_DIR))):
                LEGACY_REPORT_ENV.parse(path.read_text())

    def test_every_report_renders_as_before(self):
        old = old_environment()
        for path in REPORTS:
            source = path.read_text()
            with self.subTest(report=str(path.relative_to(DATA_DIR))):
                self.assertEqual(outcome(LEGACY_REPORT_ENV, source), outcome(old, source))

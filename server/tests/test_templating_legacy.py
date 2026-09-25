'''
The legacy reports under data/ still work in the sandboxed legacy environment
(DR-37): every one parses, and each renders exactly as it did in the old,
unsandboxed environment against the same (small) set of posted variables.
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
REPORTS = sorted(DATA_DIR.glob('*/reports/*.j2'))


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
    return {
        'event': {'id': 1, 'name': 'Camp', 'registration_end': '2026-12-15'},
        'campers': [camper],
        'registrations': [registration],
        'camperLookup': {'20': camper},
        'registrationLookup': {'10': registration},
        'lodgingLookup': {'1': root, '2': cabin},
        'registrationTypeLookup': {},
    }


def outcome(env, source):
    try:
        return ('ok', env.from_string(source).render(**bundle()))
    except Exception as exc:  # compare failures too: same kind of failure either way
        return ('error', type(exc).__name__)


@unittest.skipUnless(REPORTS, 'data/ reports not available')
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

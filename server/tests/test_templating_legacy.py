'''
The legacy reports under data/events/ still work in the sandboxed legacy environment
(DR-37): every one parses, and each renders exactly as it did in the old,
unsandboxed environment against the same (small) set of posted variables.
Sample Camp (data/events/sample-camp) keeps legacy reports here that use the
legacy environment's extensions and filters ({% do %}, {% continue %},
regex_replace, money_fmt; {% break %} is only parsed), whichever camps'
reports are in the repository.

The events data/ installs from npm (each camp's own repository)
are checked too, from data/node_modules, wherever data/ has been installed
(CI's django.yml installs it), so a server change that changes how one of
their reports renders shows up here.
'''

import json
import os
from pathlib import Path
import unittest

from django.conf import settings
from django.test import SimpleTestCase
from jinja2 import BaseLoader, Environment

from camphoric.pricing import money_fmt
from camphoric.templating.env import LEGACY_REPORT_ENV
from camphoric.templating.filters import regex_replace

DATA_DIR = (Path(settings.BASE_DIR).parent / 'data').resolve()
EVENTS_DIR = DATA_DIR / 'events'
NODE_MODULES = DATA_DIR / 'node_modules'


def registry_events():
    '''
    The events data/ installs from npm: its @camphoric/camphoric-event-*
    dependencies that aren't workspaces (which the lockfile marks as links), as
    data/scripts/registry-events.mjs finds them.
    '''
    try:
        dependencies = json.loads((DATA_DIR / 'package.json').read_text())['dependencies']
        packages = json.loads((DATA_DIR / 'package-lock.json').read_text())['packages']
    except FileNotFoundError:
        return []
    return [name for name in sorted(dependencies)
            if name.startswith('@camphoric/camphoric-event-')
            and not packages.get(f'node_modules/{name}', {}).get('link')]


REGISTRY_EVENTS = registry_events()
REPORTS = sorted([
    *EVENTS_DIR.glob('*/reports/*.j2'),
    *(report for name in REGISTRY_EVENTS for report in (NODE_MODULES / name).glob('reports/*.j2')),
])


def old_environment():
    env = Environment(extensions=['jinja2.ext.do', 'jinja2.ext.loopcontrols'],
                      loader=BaseLoader())
    env.filters['regex_replace'] = regex_replace
    env.filters['money_fmt'] = money_fmt
    return env


def bundle(with_unnamed_camper=False):
    '''
    A tiny legacy variable bundle in the client's shape; optionally with a
    second camper who has no answers yet, so reports' branches for one run.
    '''
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
    unnamed = {'id': 21, 'registration': 10, 'lodging': None, 'sequence': 1, 'stay': [],
               'attributes': {}, 'admin_attributes': {}, 'server_pricing_results': {}}
    campers = [camper, unnamed] if with_unnamed_camper else [camper]
    return {
        'event': {'id': 1, 'name': 'Camp', 'registration_end': '2026-12-15'},
        'campers': campers,
        'registrations': [registration],
        'camperLookup': {str(c['id']): c for c in campers},
        'registrationLookup': {'10': registration},
        'lodgingLookup': {'1': root, '2': cabin},
        'registrationTypeLookup': {},
    }


def outcome(env, source, variables):
    try:
        return ('ok', env.from_string(source).render(**variables))
    except Exception as exc:  # compare failures too: same kind of failure either way
        return ('error', type(exc).__name__)


@unittest.skipUnless(EVENTS_DIR.is_dir(), 'data/events/ not available')
class LegacyReportsFoundTests(SimpleTestCase):
    def test_the_event_reports_are_found(self):
        # The tests below skip without reports, so a move of the event packages
        # must not quietly turn them off.
        self.assertTrue(REPORTS, f'no reports match {EVENTS_DIR}/*/reports/*.j2')

    # In CI (django.yml installs data/), always; elsewhere, where data/ is installed
    @unittest.skipUnless(os.environ.get('CI') == 'true' or NODE_MODULES.is_dir(),
                         'data/ not installed (npm ci in data/)')
    def test_the_registry_events_reports_are_found(self):
        # Each event data/ installs from npm is installed, and the
        # reports it publishes are among those checked, so none stops being
        # checked quietly (a stale node_modules, or reports moved in a release).
        for name in REGISTRY_EVENTS:
            with self.subTest(event=name):
                package = NODE_MODULES / name / 'package.json'
                self.assertTrue(package.is_file(), f'{name} is not installed: npm ci in data/')
                if 'reports' in json.loads(package.read_text()).get('files', []):
                    self.assertTrue(any(report.is_relative_to(NODE_MODULES / name)
                                        for report in REPORTS),
                                    f'{name} publishes reports/, but none were found')


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
            # With the unnamed camper too, many real reports fail the same way in both
            # environments (e.g. sorting by an answer the camper lacks), so the
            # bundle without it is what compares their output.
            for unnamed in (False, True):
                variables = bundle(with_unnamed_camper=unnamed)
                with self.subTest(report=str(path.relative_to(DATA_DIR)), unnamed_camper=unnamed):
                    self.assertEqual(outcome(LEGACY_REPORT_ENV, source, variables),
                                     outcome(old, source, variables))

    def test_sample_camp_reports_render(self):
        # Sample Camp's legacy reports exist to run the legacy environment's
        # extensions and filters, so they must render, not just fail alike.
        reports = [path for path in REPORTS if path.parent.parent.name == 'sample-camp']
        self.assertTrue(reports)
        for path in reports:
            for unnamed in (False, True):
                with self.subTest(report=path.name, unnamed_camper=unnamed):
                    result = outcome(LEGACY_REPORT_ENV, path.read_text(),
                                     bundle(with_unnamed_camper=unnamed))
                    self.assertEqual(result[0], 'ok', result)

'''
Compare an event's saved legacy reports with converted server-variable
versions — a temporary tool for converting data/ reports (DR-41).

    manage.py dump_report_api_data --event 4 > api.json
    (client_v2) LADLE=1 npx vite-node scripts/legacy-report-outputs.mjs api.json > legacy.json
    node data/dump-reports.js harmony > new.json
    manage.py compare_report_templates --event 4 --reports new.json --legacy legacy.json

Each saved report is rendered as it is today — legacy Jinja with the client's
variable bundle (from `legacy.json`), Handlebars as the client rendered it —
and the converted report with the same title is rendered with the server's
variables. The outputs are compared after normalizing what's allowed to
differ:

- CSV is compared cell by cell (quoting, spaces after commas and trailing empty
  cells don't matter);
- numbers compare as numbers (`725.00` = `725`, `$1,234.50` = `$1234.5`);
- a legacy `None` counts as blank; HTML entities are decoded;
- markdown table rows compare cell by cell; blank lines and trailing spaces
  (other than a markdown line break) don't matter.

Rows in a different order are reported but don't fail (unsorted legacy loops
followed the API's order). Exits 1 if any report differs or fails to render.
'''

import copy
import csv
from decimal import Decimal, InvalidOperation
import difflib
import html
import io
import json
import re

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from camphoric import models
from camphoric.templating.contexts import report_context
from camphoric.templating.env import LEGACY_REPORT_ENV
from camphoric.templating.graph import build_event_graph
from camphoric.templating.render import REPORT_LIMITS, render_template

from ._report_enrichment import enrich_event

NUMBER = re.compile(
    r'(?<![\w.])-?\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![\w.])'   # 1,234.50
    r'|(?<![\w.])-?\d+(?:\.\d+)?(?![\w.])')                 # 1234.5


def canonical_number(text):
    try:
        value = Decimal(text.replace(',', ''))
    except InvalidOperation:
        return text
    if value == value.to_integral_value():
        return str(value.quantize(Decimal(1)))
    return format(value.normalize(), 'f')


def _numbers(text):
    return NUMBER.sub(lambda m: canonical_number(m.group(0)), text)


def normalize_cell(cell):
    cell = html.unescape(cell).strip()
    if cell == 'None':
        return ''
    return _numbers(cell)


def normalize_csv(text):
    rows = csv.reader(io.StringIO((text or '').strip()), skipinitialspace=True)
    normalized = []
    for row in rows:
        cells = [normalize_cell(c) for c in row]
        while cells and cells[-1] == '':  # a trailing comma adds nothing
            cells.pop()
        if cells:
            normalized.append(tuple(cells))
    return normalized


def _table_row(line):
    cells = [c.strip() for c in line.strip().strip('|').split('|')]
    cells = ['---' if re.fullmatch(r':?-+:?', c) else normalize_cell(c) for c in cells]
    return '| ' + ' | '.join(cells) + ' |'


def normalize_text(text):
    text = _numbers(re.sub(r'\bNone\b', '', html.unescape(text or '')))
    lines = []
    for line in text.splitlines():
        if line.lstrip().startswith('|'):
            lines.append(_table_row(line))
            continue
        stripped = line.rstrip()
        lines.append(stripped + ('  ' if len(line) - len(stripped) >= 2 and stripped else ''))
    return [line for line in re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip().split('\n')]


def normalize(output_type, text):
    '''Comparable rows: tuples of cells for CSV, lines otherwise.'''
    if output_type == 'csv':
        return normalize_csv(text)
    return normalize_text(text)


def _lines(rows):
    return [' | '.join(r) if isinstance(r, tuple) else r for r in rows]


class Command(BaseCommand):
    help = "Render an event's legacy reports and converted versions, and compare them."

    def add_arguments(self, parser):
        parser.add_argument('--event', type=int, required=True)
        parser.add_argument('--reports', required=True, help='Converted reports (JSON).')
        parser.add_argument('--legacy', required=True,
                            help='The legacy bundle and Handlebars outputs (JSON).')
        parser.add_argument('--show', type=int, default=3,
                            help='How many differing reports to print a diff for.')
        parser.add_argument('--only', action='append', default=[],
                            help='Only compare the report with this title (repeatable).')
        parser.add_argument('--enrich', action='store_true',
                            help='Add varied data first, as dump_report_api_data --enrich '
                                 'did (rolled back afterwards).')

    def handle(self, *args, event, reports, legacy, show, only, enrich, **options):
        try:
            event_obj = models.Event.objects.get(id=event)
        except models.Event.DoesNotExist:
            raise CommandError(f'No event {event}.')
        with open(reports) as file:
            candidates = json.load(file)
        with open(legacy) as file:
            legacy_data = json.load(file)

        saved = {r.title: r for r in models.Report.objects.filter(
            event=event_obj, deleted_at__isnull=True)}
        with transaction.atomic():
            if enrich:
                enrich_event(event_obj)
            context = report_context(build_event_graph(event_obj))
            transaction.set_rollback(True)
        failures, shown = 0, 0
        for candidate in candidates:
            title = candidate['title']
            if only and title not in only:
                continue
            report = saved.get(title)
            if report is None:
                self.stdout.write(f'skip  {title}: no saved report with this title')
                continue
            status, detail = self.compare(report, candidate, legacy_data, context)
            failures += status in ('DIFF', 'FAIL')
            self.stdout.write(f'{status:5} {title}')
            if detail and (status not in ('same', 'order') or shown < show):
                if status in ('DIFF', 'FAIL', 'OLD!'):
                    shown += 1
                    if shown > show:
                        continue
                for line in detail:
                    self.stdout.write(f'        {line}')
        missing = sorted(set(saved) - {c['title'] for c in candidates})
        for title in missing if not only else []:
            self.stdout.write(f'skip  {title}: saved, but not among the converted reports')

        if failures:
            raise CommandError(f'{failures} report(s) differ or fail.')
        self.stdout.write(self.style.SUCCESS('All reports match.'))

    def compare(self, report, candidate, legacy_data, context):
        '''(status, detail lines) for one report.'''
        new = render_template(candidate['template'], context, limits=REPORT_LIMITS,
                              fmt='html' if candidate['output'] == 'html' else 'text')
        notes = [f'{d.severity} line {d.line}: {d.message}' for d in new.diagnostics]
        if not new.ok:
            return 'FAIL', notes

        if report.output == models.ReportOutputType.HANDLEBARS:
            before = legacy_data['handlebars'].get(report.title)
            if before is None:
                return 'FAIL', ['no Handlebars output for this report in the legacy file']
        else:
            try:
                before = LEGACY_REPORT_ENV.from_string(report.template).render(
                    **copy.deepcopy(legacy_data['bundle']))
            except Exception as exc:  # the legacy report itself is broken
                preview = new.output.splitlines()[:8]
                return 'OLD!', notes + [f'the legacy report fails: {type(exc).__name__}: {exc}',
                                        'converted output starts:'] + preview

        output_type = candidate['output']
        old_rows = normalize(output_type, before)
        new_rows = normalize(output_type, new.output)
        if old_rows == new_rows:
            return ('same', notes) if notes else ('same', [])
        head = 1 if output_type == 'csv' else 0
        if old_rows[:head] == new_rows[:head] and \
                sorted(old_rows[head:]) == sorted(new_rows[head:]):
            return 'order', notes
        diff = list(difflib.unified_diff(_lines(old_rows), _lines(new_rows), 'legacy',
                                         'converted', lineterm='', n=1))
        return 'DIFF', notes + diff[:60] + (['…'] if len(diff) > 60 else [])

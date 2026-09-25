'''
Check every template of an event (SPEC §9.3): server-variable reports are
rendered against the event's data; older client-variable reports can only be
parsed here (their variables come from the browser); Handlebars reports render
in the browser and are skipped. Emails join the check as they move to Jinja.

Used by `manage.py check_templates` (CI runs it after importing data/) and by
GET /api/events/<id>/templates/check.
'''

from dataclasses import dataclass, field

from jinja2.exceptions import TemplateSyntaxError

from camphoric import models

from .contexts import report_context
from .env import LEGACY_REPORT_ENV
from .graph import build_event_graph
from .render import REPORT_LIMITS, Diagnostic, render_template


@dataclass
class CheckResult:
    kind: str         # 'report'
    id: int
    label: str
    mode: str         # 'rendered' | 'parsed' | 'skipped'
    diagnostics: list = field(default_factory=list)

    @property
    def errors(self):
        return [d for d in self.diagnostics if d.severity == 'error']

    @property
    def warnings(self):
        return [d for d in self.diagnostics if d.severity == 'warning']

    def as_dict(self):
        return {
            'kind': self.kind, 'id': self.id, 'label': self.label, 'mode': self.mode,
            'diagnostics': [d.as_dict() for d in self.diagnostics],
        }


def check_event_templates(event, *, request=None):
    reports = list(models.Report.objects.filter(event=event, deleted_at__isnull=True)
                   .order_by('title', 'id'))
    graph = None
    results = []
    for report in reports:
        label = report.title
        if report.output == models.ReportOutputType.HANDLEBARS:
            results.append(CheckResult('report', report.id, label, 'skipped'))
            continue
        if report.variables_source == models.ReportVariablesSource.SERVER:
            if graph is None:
                graph = build_event_graph(event, request=request)
            rendered = render_template(
                report.template, report_context(graph), limits=REPORT_LIMITS,
                fmt='html' if report.output == models.ReportOutputType.HTML else 'text')
            results.append(CheckResult('report', report.id, label, 'rendered',
                                       rendered.diagnostics))
            continue
        diagnostics = []
        try:
            LEGACY_REPORT_ENV.parse(report.template)
        except TemplateSyntaxError as exc:
            diagnostics.append(Diagnostic(severity='error', kind='syntax',
                                          message=exc.message or str(exc), line=exc.lineno))
        results.append(CheckResult('report', report.id, label, 'parsed', diagnostics))
    return results

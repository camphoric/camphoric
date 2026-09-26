'''
Check every template of an event (SPEC §9.3): server-variable reports are
rendered against the event's data; older client-variable reports can only be
parsed here (their variables come from the browser); Handlebars reports render
in the browser and are skipped. The confirmation email is rendered for every
completed registration, each invitation email for its registration type's
invitations (or an example one), and each group email for the recipients its
default audience reaches.

Used by `manage.py check_templates` (CI runs it after importing data/) and by
GET /api/events/<id>/templates/check.
'''

from dataclasses import dataclass, field

from jinja2.exceptions import TemplateSyntaxError

from camphoric import models

from .contexts import (
    confirmation_email_context, confirmation_page_context, example_invitation,
    invitation_email_context, report_context)
from .bulk import Criteria, candidate_context, resolve_recipients
from .emails import render_jinja_email
from .env import LEGACY_REPORT_ENV
from .graph import build_event_graph
from .render import EMAIL_LIMITS, REPORT_LIMITS, Diagnostic, render_template, syntax_error


@dataclass
class CheckResult:
    kind: str  # report | confirmation_email | confirmation_page | invitation_email | group_email
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

    if graph is None:
        graph = build_event_graph(event, request=request)
    results.append(_check_confirmation_email(event, graph))
    results.append(_check_confirmation_page(event, graph))
    for registration_type in models.RegistrationType.objects.filter(
            event=event, deleted_at__isnull=True).order_by('id'):
        results.append(_check_invitation_email(registration_type, graph))
    for template in models.EmailTemplate.objects.filter(
            event=event, purpose=models.EmailTemplatePurpose.GROUP).order_by('name', 'id'):
        results.append(_check_group_email(template, event, graph))
    return results


def _render_for_each(subject, body, contexts_):
    '''
    Render an email for each context; each distinct problem is reported once,
    saying how many of the renders it affected.
    '''
    found = {}
    for context in contexts_:
        for diagnostic in render_jinja_email(subject, body, context, limits=EMAIL_LIMITS) \
                .diagnostics:
            key = (diagnostic.severity, diagnostic.field, diagnostic.line, diagnostic.message)
            found.setdefault(key, [diagnostic, 0])[1] += 1
    diagnostics = []
    for diagnostic, count in found.values():
        if len(contexts_) > 1:
            diagnostic.message += f' ({count} of {len(contexts_)})'
        diagnostics.append(diagnostic)
    return diagnostics


def _parsed(kind, id_, label, subject, body):
    '''Nothing to render for (no registrations yet): check the syntax only.'''
    problems = [syntax_error(subject, field='subject'), syntax_error(body)]
    return CheckResult(kind, id_, label, 'parsed', [p for p in problems if p])


def _texts(template):
    return (template.subject, template.body) if template else ('', '')


def _check_confirmation_email(event, graph):
    label = 'Confirmation email'
    subject, body = _texts(event.confirmation_template)
    if not graph.registrations:
        return _parsed('confirmation_email', event.id, label, subject, body)
    contexts_ = [confirmation_email_context(graph, r) for r in graph.registrations]
    return CheckResult('confirmation_email', event.id, label, 'rendered',
                       _render_for_each(subject, body, contexts_))


def _check_confirmation_page(event, graph):
    label = 'Confirmation page'
    if not graph.registrations:
        return _parsed('confirmation_page', event.id, label, '', event.confirmation_page_template)
    contexts_ = [confirmation_page_context(graph, r) for r in graph.registrations]
    return CheckResult('confirmation_page', event.id, label, 'rendered', _render_for_each(
        '', event.confirmation_page_template, contexts_))


def _check_invitation_email(registration_type, graph):
    label = f'Invitation email: {registration_type.label}'
    subject, body = _texts(registration_type.invitation_template)
    type_var = graph.get('registration_type', registration_type.id)
    invitations = [i for i in graph.invitations if i['registration_type'] is type_var] \
        or [example_invitation(graph, type_var)]
    return CheckResult('invitation_email', registration_type.id, label, 'rendered',
                       _render_for_each(subject, body,
                                        [invitation_email_context(graph, i) for i in invitations]))


def _check_group_email(template, event, graph):
    label = f'Group email: {template.name}'
    criteria = Criteria.of_template(template)
    resolution = resolve_recipients(event, criteria, graph=graph)
    if not resolution.recipients:
        result = _parsed('group_email', template.id, label, template.subject, template.body)
        result.diagnostics = resolution.diagnostics + result.diagnostics
        return result
    return CheckResult('group_email', template.id, label, 'rendered',
                       resolution.diagnostics + _render_for_each(
                           template.subject, template.body,
                           [candidate_context(graph, criteria.kind, c)
                            for c in resolution.recipients]))

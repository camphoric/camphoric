'''
Rendering the confirmation and invitation emails (SPEC §8.3, §8.4, DR-45).

Each is an email template (the event's confirmation, a registration type's
invitation) in Jinja: the subject and body render against the event's variable
graph (SPEC §9.3) in the sandbox, with the email limits; the body is markdown,
sent as text and as HTML.
'''

from dataclasses import dataclass, field

import cmarkgfm


from .contexts import confirmation_email_context, invitation_email_context
from .graph import build_event_graph
from .render import EMAIL_LIMITS, render_template
from .urls import admin_registration_url

MAX_SUBJECT = 255


@dataclass
class RenderedEmail:
    subject: str
    text: str
    html: str
    diagnostics: list = field(default_factory=list)

    @property
    def ok(self):
        return not any(d.severity == 'error' for d in self.diagnostics)

    @property
    def errors(self):
        return [d for d in self.diagnostics if d.severity == 'error']


def markdown_to_html(text):
    return cmarkgfm.github_flavored_markdown_to_html(text)


def render_jinja_email(subject_template, body_template, context, *, limits=EMAIL_LIMITS):
    '''Render a Jinja subject and markdown body (also used by the preview).'''
    subject = render_template(subject_template or '', context, limits=limits, field='subject')
    body = render_template(body_template or '', context, limits=limits, field='template')
    return RenderedEmail(
        subject=' '.join(subject.output.split())[:MAX_SUBJECT],
        text=body.output,
        html=markdown_to_html(body.output),
        diagnostics=subject.diagnostics + body.diagnostics,
    )


def _template(template):
    return (template.subject, template.body) if template else ('', '')


def render_confirmation_email(registration, *, request=None):
    '''The confirmation email for a completed registration (its event's template).'''
    event = registration.event
    graph = build_event_graph(event, registration_ids=[registration.id], request=request)
    context = confirmation_email_context(graph, graph.get('registration', registration.id))
    return render_jinja_email(*_template(event.confirmation_template), context)


def render_invitation_email(invitation, *, request=None):
    '''The email inviting someone to register as their registration type (its template).'''
    registration_type = invitation.registration_type
    graph = build_event_graph(registration_type.event, registration_ids=[], request=request)
    context = invitation_email_context(graph, graph.get('invitation', invitation.id))
    return render_jinja_email(*_template(registration_type.invitation_template), context)


def _describe(diagnostic, subject, body):
    source = subject if diagnostic.field == 'subject' else body
    where = diagnostic.field
    excerpt = ''
    if diagnostic.line:
        where += f', line {diagnostic.line}'
        if diagnostic.column:
            where += f', column {diagnostic.column}'
        lines = (source or '').splitlines()
        if diagnostic.line <= len(lines):
            excerpt = f'\n    {lines[diagnostic.line - 1].strip()}'
    return f'- {diagnostic.severity.upper()} ({where}): {diagnostic.message}{excerpt}'


def confirmation_failure_report(registration, rendered, *, request=None):
    '''
    The subject and body of the report sent to the event's confirmation "from"
    address when a Jinja confirmation email can't be rendered (the registrant
    is sent nothing).
    '''
    event = registration.event
    link = admin_registration_url(registration, request)
    problems = '\n'.join(
        _describe(d, *_template(event.confirmation_template))
        for d in rendered.diagnostics)
    subject = f'Confirmation email not sent: {event.name}, registration #{registration.id}'
    body = (
        f'The confirmation email for a new registration to {event.name} could not be '
        'rendered, so it was not sent. The registration itself is complete.\n\n'
        f'Registration: #{registration.id}\n'
        f'Registrant: {registration.registrant_email}\n'
        + (f'Admin link: {link}\n' if link else '')
        + '\nProblems in the confirmation email template:\n'
        f'{problems}\n\n'
        'Fix the template (Home › Confirmation email; its preview shows the same problems), '
        'then send the registrant their confirmation by hand.\n'
    )
    return subject, body

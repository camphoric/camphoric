'''
Rendering the confirmation and invitation emails (SPEC §8.3, §8.4, DR-38).

Each template has an engine. `mustache` renders exactly as Camphoric always
has — the same thin variables, and a subject that isn't a template. `jinja`
renders the subject and body against the event's variable graph (SPEC §9.3)
in the sandbox, with the email limits; the body is markdown, sent as text and
as HTML. Both return a `RenderedEmail`; only Jinja can have diagnostics.
'''

from dataclasses import dataclass, field

import chevron
import cmarkgfm

from camphoric import models

from .contexts import confirmation_email_context, invitation_email_context
from .graph import build_event_graph
from .render import EMAIL_LIMITS, render_template
from .urls import admin_registration_url, register_url

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


def _mustache_email(subject, template, variables):
    text = chevron.render(template or '', variables)
    return RenderedEmail(subject=subject or '', text=text, html=markdown_to_html(text))


def render_confirmation_email(registration, *, request=None):
    '''The confirmation email for a completed registration.'''
    event = registration.event
    if event.confirmation_email_engine == models.TemplateEngine.JINJA:
        graph = build_event_graph(event, registration_ids=[registration.id], request=request)
        context = confirmation_email_context(graph, graph.get('registration', registration.id))
        return render_jinja_email(event.confirmation_email_subject,
                                  event.confirmation_email_template, context)

    # Mustache: the variables Camphoric has always passed.
    pricing_results = registration.server_pricing_results
    campers = []
    for camper_index, camper in enumerate(registration.campers.all()):
        campers.append({
            **camper.attributes,
            'pricing_result': pricing_results['campers'][camper_index],
            'lodging': (camper.lodging.name if camper.lodging else 'none'),
            'lodging_full': (camper.lodging.name_path if camper.lodging else 'none'),
        })
    return _mustache_email(event.confirmation_email_subject, event.confirmation_email_template, {
        'registration': registration,
        'campers': campers,
        'pricing_results': pricing_results,
        'initial_payment': registration.initial_payment,
    })


def render_invitation_email(invitation, *, request=None):
    '''The email inviting someone to register with their registration type.'''
    registration_type = invitation.registration_type
    event = registration_type.event
    if registration_type.invitation_email_engine == models.TemplateEngine.JINJA:
        graph = build_event_graph(event, registration_ids=[], request=request)
        context = invitation_email_context(graph, graph.get('invitation', invitation.id))
        return render_jinja_email(registration_type.invitation_email_subject,
                                  registration_type.invitation_email_template, context)

    return _mustache_email(
        registration_type.invitation_email_subject,
        registration_type.invitation_email_template, {
            'recipient_name': invitation.recipient_name or invitation.recipient_email,
            'recipient_email': invitation.recipient_email,
            'invitation_code': invitation.invitation_code,
            'register_link': register_url(event.id, invitation, request),
        })


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
        _describe(d, event.confirmation_email_subject, event.confirmation_email_template)
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

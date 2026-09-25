'''
The confirmation page (SPEC §7.3, DR-42).

The page is a Jinja markdown template. It renders on the server when a
registration completes, with the confirmation email's variables, and the
payment step returns the markdown; the registration client only turns it into
(sanitized) HTML.
'''

from .contexts import confirmation_page_context
from .graph import build_event_graph
from .render import EMAIL_LIMITS, render_template

# Shown when a Jinja page can't be rendered (the organizer is told why).
FALLBACK_PAGE = '# Thank you — your registration is complete!'


def render_confirmation_page(registration, *, request=None, graph=None, template=None):
    '''A RenderResult of the event's confirmation page (or `template`) for a registration.'''
    event = registration.event
    if graph is None:
        graph = build_event_graph(event, registration_ids=[registration.id], request=request)
    context = confirmation_page_context(graph, graph.get('registration', registration.id))
    source = event.confirmation_page_template if template is None else template
    return render_template(source, context, limits=EMAIL_LIMITS)


def page_failure_report(registration, diagnostics, *, request=None):
    '''
    The report sent to the event's confirmation "from" address when the
    confirmation page can't be rendered (the registrant sees FALLBACK_PAGE).
    '''
    from .emails import _describe  # the same problem lines as the email report
    from .urls import admin_registration_url

    event = registration.event
    link = admin_registration_url(registration, request)
    problems = '\n'.join(_describe(d, '', event.confirmation_page_template) for d in diagnostics)
    subject = f'Confirmation page not shown: {event.name}, registration #{registration.id}'
    body = (
        f'The confirmation page for a new registration to {event.name} could not be '
        'rendered, so the registrant saw a short generic message instead. The registration '
        'itself is complete.\n\n'
        f'Registration: #{registration.id}\n'
        f'Registrant: {registration.registrant_email}\n'
        + (f'Admin link: {link}\n' if link else '')
        + '\nProblems in the confirmation page template:\n'
        f'{problems}\n\n'
        'Fix the template (Home › Confirmation page; its preview shows the same problems).\n'
    )
    return subject, body

'''
Template endpoints for the admin (SPEC §5, §9.3):

  GET  /api/events/<id>/templates/describe  what templates can use (DR-37)
  POST /api/events/<id>/templates/preview   render unsaved template text

Preview request:
  {context, template, output: csv|md|txt|html|email, subject?,
   registration_id?, camper_id?, invitation_id?, registration_type_id?}
Preview response:
  {output, subject?, html?, diagnostics: [...], truncated, duration_ms,
   sample: {kind, id, label} | null}

Template mistakes are reported as diagnostics with a 200; a bad request (an
unknown context, a sample that isn't in this event) is a 400.
'''

import cmarkgfm
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from camphoric import models

from . import contexts, registry
from .describe import describe
from .graph import build_event_graph
from .render import PREVIEW_LIMITS, render_template
from .values import InvitationVar

OUTPUTS = ('csv', 'md', 'txt', 'html', 'email')


class TemplateDescribeView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, event_id=None):
        event = get_object_or_404(models.Event, id=event_id)
        return Response(describe(event))


def _sample_label(kind, obj):
    if obj is None:
        return None
    if kind == 'registration':
        return f"Registration #{obj['id']} ({obj['registrant_email']})"
    if kind == 'camper':
        attributes = obj['attributes']
        name = ' '.join(str(attributes.get(k, '')) for k in ('first_name', 'last_name')).strip()
        return f"Camper #{obj['id']}" + (f' ({name})' if name else '')
    if kind == 'invitation':
        return f"Invitation to {obj['recipient_email']}"
    return None


class BadSample(Exception):
    pass


def _pick(graph, kind, requested_id, pool):
    '''The requested sample (which must belong to the event), else the first.'''
    if requested_id is not None:
        obj = graph.get(kind, int(requested_id))
        if obj is None:
            raise BadSample(f'{kind} {requested_id} is not part of this event')
        return obj
    return pool[0] if pool else None


def _example_invitation(graph, registration_type):
    '''A stand-in invitation for previews when none has been sent yet.'''
    return InvitationVar(
        id=0,
        recipient_name='Alex Sample',
        recipient_email='alex@example.com',
        code='abcd2345',
        registration_type=registration_type,
        registration=None,
        sent_time=None,
        expiration_time=None,
        register_url=graph.event['register_url']
        + ('&' if '?' in graph.event['register_url'] else '?')
        + 'email=alex@example.com&code=abcd2345',
        redeemed=False,
    )


def build_preview_context(graph, name, data):
    '''The context for `name` plus the sample record it was rendered for.'''
    if name == 'report':
        return contexts.report_context(graph), None
    if name in ('confirmation_email', 'bulk_email_registration'):
        registration = _pick(graph, 'registration', data.get('registration_id'),
                             graph.registrations)
        sample = ('registration', registration)
        if name == 'confirmation_email':
            return contexts.confirmation_email_context(graph, registration), sample
        to = contexts.recipient(
            registration['registrant_email'] if registration else 'alex@example.com')
        return contexts.bulk_email_registration_context(graph, registration, to), sample
    if name == 'bulk_email_camper':
        camper = _pick(graph, 'camper', data.get('camper_id'), graph.campers)
        email = ''
        if camper is not None:
            email = camper['attributes'].get('email') or camper['registration']['registrant_email']
        to = contexts.recipient(email or 'alex@example.com')
        return contexts.bulk_email_camper_context(graph, camper, to), ('camper', camper)
    if name == 'bulk_email_manual':
        return contexts.bulk_email_manual_context(
            graph, contexts.recipient('alex@example.com', 'Alex Sample')), None
    if name == 'invitation_email':
        registration_type = None
        if data.get('registration_type_id') is not None:
            registration_type = graph.get('registration_type', int(data['registration_type_id']))
            if registration_type is None:
                raise BadSample('registration type '
                                f"{data['registration_type_id']} is not part of this event")
        pool = [i for i in graph.invitations
                if registration_type is None or i['registration_type'] == registration_type]
        invitation = _pick(graph, 'invitation', data.get('invitation_id'), pool)
        if invitation is None:
            invitation = _example_invitation(
                graph, registration_type or (graph.registration_types[0]
                                             if graph.registration_types else None))
        return contexts.invitation_email_context(graph, invitation), ('invitation', invitation)
    raise BadSample(f'unknown context {name!r}')


class TemplatePreviewView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, event_id=None):
        event = get_object_or_404(models.Event, id=event_id)
        data = request.data if isinstance(request.data, dict) else {}
        name = data.get('context')
        output = data.get('output', 'txt')
        template = data.get('template', '')
        if name not in registry.CONTEXTS_BY_NAME:
            return Response({'detail': f'unknown context {name!r}'},
                            status=status.HTTP_400_BAD_REQUEST)
        if output not in OUTPUTS:
            return Response({'detail': f'output must be one of {", ".join(OUTPUTS)}'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(template, str):
            return Response({'detail': 'template must be text'},
                            status=status.HTTP_400_BAD_REQUEST)

        graph = build_event_graph(event, request=request)
        try:
            context, sample = build_preview_context(graph, name, data)
        except (BadSample, ValueError) as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        body = render_template(template, context, fmt='html' if output == 'html' else 'text',
                               limits=PREVIEW_LIMITS)
        response = body.as_dict()
        if output == 'email':
            subject = render_template(data.get('subject') or '', context,
                                      limits=PREVIEW_LIMITS, field='subject')
            response['subject'] = ' '.join(subject.output.split())[:255]
            response['diagnostics'] = [d.as_dict() for d in subject.diagnostics] \
                + response['diagnostics']
            response['html'] = cmarkgfm.github_flavored_markdown_to_html(body.output)
        kind, obj = sample if sample else (None, None)
        response['sample'] = (
            {'kind': kind, 'id': obj['id'], 'label': _sample_label(kind, obj)}
            if obj is not None else None
        )
        return Response(response)

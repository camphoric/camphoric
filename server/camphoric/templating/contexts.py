'''
The variables each kind of template receives (SPEC §9.3). The names and types
must match `registry.CONTEXTS` (a test checks).
'''

from django.utils import timezone

from .graph import template_timezone
from .values import ReadOnlyList, RecipientVar


def _now():
    return timezone.localtime(timezone.now(), template_timezone())


def report_context(graph):
    now = _now()
    return {
        'event': graph.event,
        'registrations': graph.registrations,
        'incomplete_registrations': graph.incomplete_registrations,
        'campers': graph.campers,
        'payments': graph.payments,
        'lodging': graph.lodging_root,
        'lodgings': graph.lodgings,
        'registration_types': graph.registration_types,
        'custom_charge_types': graph.custom_charge_types,
        'invitations': graph.invitations,
        'today': now.date(),
        'now': now,
    }


def confirmation_email_context(graph, registration):
    return {
        'event': graph.event,
        'registration': registration,
        'campers': registration['campers'] if registration else ReadOnlyList(),
        'pricing': registration['pricing'] if registration else None,
        'initial_payment': registration['initial_payment'] if registration else None,
    }


def invitation_email_context(graph, invitation):
    return {
        'event': graph.event,
        'invitation': invitation,
        'registration_type': invitation['registration_type'] if invitation else None,
    }


def recipient(email, name=''):
    return RecipientVar(id=email, email=email, name=name)


def bulk_email_registration_context(graph, registration, to):
    return {
        'event': graph.event,
        'registration': registration,
        'campers': registration['campers'] if registration else ReadOnlyList(),
        'recipient': to,
    }


def bulk_email_camper_context(graph, camper, to):
    return {
        'event': graph.event,
        'camper': camper,
        'registration': camper['registration'] if camper else None,
        'recipient': to,
    }


def bulk_email_manual_context(graph, to):
    return {'event': graph.event, 'recipient': to}

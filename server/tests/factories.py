'''
A small but representative event for templating tests: a lodging tree,
completed and incomplete registrations, payments, a custom charge, a
registration type with a schema override, and invitations.
'''

import datetime
from decimal import Decimal

from camphoric import models

REGISTRATION_SCHEMA = {
    'type': 'object',
    'definitions': {
        'address': {
            'type': 'object',
            'properties': {
                'street': {'type': 'string', 'title': 'Street'},
                'city': {'type': 'string', 'title': 'City'},
            },
        },
    },
    'properties': {
        'comments': {'type': 'string', 'title': 'Comments'},
        'address': {'title': 'Main address', '$ref': '#/definitions/address'},
        'campership_donation': {'type': 'integer', 'title': 'Campership donation'},
        'donation-note': {'type': 'string', 'title': 'Donation note'},
    },
}

CAMPER_SCHEMA = {
    'type': 'object',
    'properties': {
        'first_name': {'type': 'string', 'title': 'First name'},
        'last_name': {'type': 'string', 'title': 'Last name'},
        'email': {'type': 'string', 'format': 'email', 'title': 'Email'},
        'linens': {'type': 'boolean', 'title': 'Linens rental'},
        'meal_type': {'type': 'string', 'title': 'Meals', 'enum': ['Omnivore', 'Vegetarian']},
        'emergency_contact': {
            'type': 'object',
            'title': 'Emergency contact',
            'properties': {
                'name': {'type': 'string', 'title': 'Full name'},
                'phone': {'type': 'string', 'title': 'Phone'},
            },
        },
        'attendance': {
            'type': 'array',
            'title': 'Attendance',
            'items': {'type': 'string', 'enum': ['Fri', 'Sat']},
        },
        'driving': {'type': 'string', 'title': 'Driving?', 'enum': ['Driver', 'Passenger']},
        'mailing_address': {'$ref': '#/definitions/address', 'title': 'Mailing address'},
    },
    'dependencies': {
        'driving': {
            'oneOf': [
                {'properties': {'driving': {'enum': ['Passenger']}}},
                {
                    'properties': {
                        'driving': {'enum': ['Driver']},
                        'license_plate': {'type': 'string', 'title': 'License plate'},
                    },
                },
            ],
        },
    },
}


def create_template_event():
    '''Create the event and return a namespace of everything created.'''
    class Made:
        pass
    made = Made()

    made.organization = models.Organization.objects.create(name='Camp Org')
    made.event = event = models.Event.objects.create(
        organization=made.organization,
        name='Test Camp',
        start=datetime.date(2026, 12, 30),
        end=datetime.date(2027, 1, 4),
        registration_start=datetime.date(2026, 1, 1),
        registration_end=datetime.date(2026, 12, 15),
        registration_schema=REGISTRATION_SCHEMA,
        camper_schema=CAMPER_SCHEMA,
        camper_admin_schema={
            'checked_in': {'data': {'type': 'boolean', 'title': 'Checked in'}, 'ui': {}},
        },
        pricing={'adult': 400, 'linen_rate': 25},
        registration_pricing_logic=[
            {'var': 'donation', 'label': 'Campership donation',
             'exp': {'var': ['registration.campership_donation', 0]}},
            {'var': 'total', 'exp': {'var': 'donation'}},
        ],
        camper_pricing_logic=[
            {'var': 'tuition', 'label': 'Tuition', 'exp': {'var': 'pricing.adult'}},
            {'var': 'total', 'exp': {'var': 'tuition'}},
        ],
        registration_template_vars={'venue': 'Camp Newman'},
        confirmation_email_from='camp@example.com',
    )

    made.staff = models.RegistrationType.objects.create(
        event=event, name='staff', label='Staff',
        registration_schema_overrides={
            'properties': {'staff_role': {'type': 'string', 'title': 'Staff role'}},
        },
    )
    set_email(made.staff.invitation_template, subject='Join us')
    made.linens = models.CustomChargeType.objects.create(
        event=event, name='linens', label='Linens')

    lodging = event.lodging_set
    made.root = lodging.create(name='Camp')
    made.cabins = lodging.create(name='Cabins', parent=made.root, visible=True)
    made.cabin_a = lodging.create(name='Cabin A', parent=made.cabins, capacity=4, visible=True)
    made.cabin_b = lodging.create(name='Cabin B', parent=made.cabins, capacity=4, visible=True)
    made.tents = lodging.create(name='Tents', parent=made.root, visible=True)
    made.tent_1 = lodging.create(name='Tent 1', parent=made.tents, capacity=2, visible=True)

    made.r1 = models.Registration.objects.create(
        event=event, registrant_email='pat@example.com', completed=True, payment_type='Check',
        attributes={'comments': 'Hi', 'campership_donation': 25,
                    'address': {'street': '1 Main St', 'city': 'Berkeley'}},
    )
    made.c1 = made.r1.campers.create(
        sequence=0, lodging=made.cabin_a, lodging_requested=made.cabin_a,
        stay=['2026-12-30', '2026-12-31'],
        attributes={'first_name': 'Pat', 'last_name': 'Alpha', 'linens': True,
                    'emergency_contact': {'name': 'Jo', 'phone': '555'}},
        admin_attributes={'checked_in': True},
    )
    made.c2 = made.r1.campers.create(
        sequence=1, lodging=made.cabin_a, stay=['2026-12-31'],
        attributes={'first_name': 'Sam', 'last_name': 'Alpha'},
    )
    models.Payment.objects.create(
        registration=made.r1, amount=Decimal('100.00'), paid_on=datetime.date(2026, 10, 1),
        payment_type='Check')
    models.CustomCharge.objects.create(
        custom_charge_type=made.linens, camper=made.c1, amount=Decimal('25.00'), notes='Sheets')

    made.r2 = models.Registration.objects.create(
        event=event, registrant_email='lee@example.com', completed=True, payment_type='PayPal',
        registration_type=made.staff, attributes={'staff_role': 'Cook'},
    )
    made.c3 = made.r2.campers.create(
        sequence=0, lodging=made.tent_1, stay=['2026-12-30', '2026-12-31', '2027-01-01'],
        attributes={'first_name': 'Lee', 'last_name': 'Beta'},
    )
    for amount, day in (('200.00', 2), ('250.50', 3)):
        models.Payment.objects.create(
            registration=made.r2, amount=Decimal(amount),
            paid_on=datetime.date(2026, 10, day), payment_type='PayPal')

    made.r3 = models.Registration.objects.create(
        event=event, registrant_email='drew@example.com', completed=False,
    )
    made.c4 = made.r3.campers.create(
        sequence=0, lodging=made.cabin_b, attributes={'first_name': 'Drew', 'last_name': 'Gamma'})

    made.invited = models.Invitation.objects.create(
        registration_type=made.staff, registration=made.r2, recipient_name='Lee',
        recipient_email='lee@example.com', invitation_code='abcd2345')
    made.pending = models.Invitation.objects.create(
        registration_type=made.staff, recipient_name='Kim',
        recipient_email='kim@example.com', invitation_code='wxyz6789')

    for registration in (made.r1, made.r2, made.r3):
        registration.recalculate_server_pricing()
        registration.refresh_from_db()

    return made


def set_email(template, subject=None, body=None):
    '''Set an email template's subject and/or body (the confirmation, an invitation).'''
    if subject is not None:
        template.subject = subject
    if body is not None:
        template.body = body
    template.save()
    return template

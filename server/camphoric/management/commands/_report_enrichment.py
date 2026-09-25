'''
More varied report data for comparing converted reports (DR-41) — a
temporary tool, only ever used inside a transaction that is rolled back.

The live-import test data has a few registrations per event and none of what
admins add later (stays, admin fields, registration types, payments), so most
report branches never run. `enrich_event` adds deterministic copies of each
completed registration and fills those gaps from the event's own schemas.
Ids and timestamps are fixed, so `dump_report_api_data --enrich` and
`compare_report_templates --enrich`, run separately, see the same records.
'''

import datetime
import uuid

from camphoric import models

COPIES = 3
REGISTRATION_ID = 900_000
CAMPER_ID = 910_000
PAYMENT_ID = 920_000
NAMESPACE = uuid.UUID('6b1f5ac8-0a4e-4c9c-9d6d-3f1c5e7a2b10')


def _resolve(schema, definitions):
    ref = schema.get('$ref', '') if isinstance(schema, dict) else ''
    if ref.startswith('#/definitions/'):
        return definitions.get(ref.split('/')[-1], {})
    return schema if isinstance(schema, dict) else {}


def sample_value(schema, index, key, definitions, depth=0):
    '''A plausible value for a JSON Schema, varying with `index`.'''
    schema = _resolve(schema, definitions)
    for branch in ('oneOf', 'anyOf'):
        if schema.get(branch):
            schema = {**_resolve(schema[branch][0], definitions), **{
                k: v for k, v in schema.items() if k != branch}}
    if isinstance(schema.get('enum'), list) and schema['enum']:
        return schema['enum'][index % len(schema['enum'])]
    kind = schema.get('type')
    if isinstance(kind, list):
        kind = next((k for k in kind if k != 'null'), None)
    if kind == 'boolean':
        return index % 2 == 0
    if kind in ('integer', 'number'):
        return index % 5 + 1
    if kind == 'array':
        items = _resolve(schema.get('items') or {}, definitions)
        if depth > 2:
            return []
        choices = items.get('enum') or schema.get('enum')
        if isinstance(choices, list) and choices:
            # A different combination of the choices for each index.
            return [c for bit, c in enumerate(choices) if (index >> bit) & 1]
        if items.get('type') == 'object' or items.get('properties'):
            return [sample_value(items, index + n, key, definitions, depth + 1)
                    for n in range(index % 3)]
        return [sample_value(items, index, key, definitions, depth + 1)]
    if kind == 'object' or schema.get('properties'):
        if depth > 2:
            return {}
        return {name: sample_value(child, index, name, definitions, depth + 1)
                for name, child in (schema.get('properties') or {}).items()}
    if schema.get('format') == 'email':
        return f'enriched{index}@example.com'
    if schema.get('format') == 'date':
        return (datetime.date(2026, 1, 1) + datetime.timedelta(days=index)).isoformat()
    return f"{schema.get('title') or key} {index}"


def _fill(attributes, schema, index, definitions):
    '''Add sample values for the questions this record left unanswered or empty.'''
    attributes = dict(attributes or {})
    for key, child in ((schema or {}).get('properties') or {}).items():
        if attributes.get(key) in (None, '', [], {}) and index % 2 == 1:
            attributes[key] = sample_value(child, index, key, definitions)
    return attributes


def _stay(nights, index):
    '''Full, first half, second half, late arrival, one night, or none.'''
    half = max(1, len(nights) // 2)
    pattern = index % 6
    if pattern == 5 or not nights:
        return None
    chosen = [nights, nights[:half], nights[half:], nights[1:], nights[:1]][pattern]
    return [night.isoformat() for night in chosen]


def enrich_event(event):
    '''Add varied registrations, campers and payments to `event` (roll back after!).'''
    definitions = {**(event.registration_schema or {}).get('definitions', {}),
                   **(event.camper_schema or {}).get('definitions', {})}
    admin_schema = event.camper_admin_schema if isinstance(event.camper_admin_schema, dict) \
        else {}
    types = list(models.RegistrationType.objects.filter(event=event).order_by('id'))
    nights = []
    if event.start and event.end:
        day = event.start
        while day < event.end:
            nights.append(day)
            day += datetime.timedelta(days=1)
    start = datetime.datetime.combine(event.start or datetime.date(2026, 1, 1),
                                      datetime.time(17), tzinfo=datetime.timezone.utc)

    originals = list(models.Registration.objects.filter(
        event=event, completed=True).order_by('id'))
    registrations, campers = [], []
    for copy_number in range(COPIES + 1):
        for original in originals:
            campers_of = list(original.campers.order_by('sequence', 'id'))
            if copy_number == 0:
                registration = original
            else:
                number = len(registrations)
                registration = models.Registration.objects.create(
                    id=REGISTRATION_ID + number,
                    uuid=uuid.uuid5(NAMESPACE, f'{event.id}-{number}'),
                    event=event,
                    registrant_email=f'copy{copy_number}.{original.registrant_email}',
                    attributes=original.attributes,
                    admin_attributes=original.admin_attributes,
                    server_pricing_results=original.server_pricing_results,
                    initial_payment=original.initial_payment,
                    payment_type=original.payment_type,
                    completed=True,
                )
                for camper in campers_of:
                    campers.append((models.Camper.objects.create(
                        id=CAMPER_ID + len(campers),
                        registration=registration,
                        lodging_id=camper.lodging_id,
                        lodging_requested_id=camper.lodging_requested_id,
                        lodging_shared=camper.lodging_shared,
                        lodging_shared_with=camper.lodging_shared_with,
                        lodging_comments=camper.lodging_comments,
                        server_pricing_results=camper.server_pricing_results,
                        attributes=camper.attributes,
                        sequence=camper.sequence,
                    ), registration))
            if copy_number == 0:
                campers.extend((camper, registration) for camper in campers_of)
            registrations.append(registration)

    for index, registration in enumerate(registrations):
        created = start - datetime.timedelta(days=150 - 9 * index, minutes=-index)
        models.Registration.objects.filter(id=registration.id).update(
            created_at=created, updated_at=created,
            registration_type=(types[index % len(types)] if types and index % 3 else None),
            attributes=_fill(registration.attributes, event.registration_schema, index,
                             definitions),
        )
        total = (registration.server_pricing_results or {}).get('total') or 0
        if index % 3:
            payment = models.Payment.objects.create(
                id=PAYMENT_ID + index, registration=registration, payment_type='Check',
                paid_on=created.date(),
                amount=round(float(total) / (2 if index % 3 == 1 else 1), 2))
            models.Payment.objects.filter(id=payment.id).update(created_at=created,
                                                                updated_at=created)

    for index, (camper, registration) in enumerate(campers):
        admin = {}
        if index % 3:
            for key, entry in admin_schema.items():
                data = entry.get('data', {}) if isinstance(entry, dict) else {}
                admin[key] = sample_value(data, index, key, definitions)
        created = registrations[0].created_at
        models.Camper.objects.filter(id=camper.id).update(
            stay=_stay(nights, index),
            # Some campers without a stay are unassigned too. (Legacy reports that
            # crash on an unassigned camper who has a stay are fixed, not compared.)
            lodging_id=None if index % 12 == 5 else camper.lodging_id,
            admin_attributes=admin,
            attributes=_fill(camper.attributes, event.camper_schema, index, definitions),
            created_at=created, updated_at=created,
        )

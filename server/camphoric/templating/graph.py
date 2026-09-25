'''
The variable graph: one event's data as read-only, relationship-resolved plain
objects (SPEC §9.3, DR-35). `camper.registration`, `camper.lodging`,
`registration.campers`, `lodging.parent` … are the objects themselves, so
templates never look records up by id.

`build_event_graph` runs a fixed number of queries whatever the event's size
and wires the relationships in memory. The field names and types here must
match `registry.TYPES` exactly (a test checks), because that description is
what the editor and help pages show template authors.

Conventions:
  - money is a `Decimal` with two places; other numbers from JSON stay numbers;
  - dates are `datetime.date`; datetimes are timezone-aware, in
    `CAMPHORIC_TEMPLATE_TIMEZONE`;
  - soft-deleted rows are left out;
  - form answers (`attributes`) and pricing results are read-only dicts.
'''

from dataclasses import dataclass, field
import datetime
from decimal import Decimal, InvalidOperation
import zoneinfo

from django.conf import settings
from django.utils import timezone

from camphoric import models
from camphoric.lodging import LodgingTree

from .urls import register_url
from .values import (
    CamperVar,
    CustomChargeTypeVar,
    CustomChargeVar,
    EventVar,
    InvitationVar,
    LodgingVar,
    PaymentVar,
    ReadOnlyList,
    RegistrationTypeVar,
    RegistrationVar,
    freeze,
)

CENT = Decimal('0.01')


def template_timezone():
    name = getattr(settings, 'CAMPHORIC_TEMPLATE_TIMEZONE', 'America/Los_Angeles')
    return zoneinfo.ZoneInfo(name)


def money(value):
    '''A money amount as a two-place Decimal (None stays None).'''
    if value is None:
        return None
    try:
        return Decimal(str(value)).quantize(CENT)
    except (InvalidOperation, ValueError):
        return None


def number(value):
    '''Pricing results: floats become exact Decimals, other values pass through.'''
    if isinstance(value, float):
        return Decimal(str(value))
    return value


def local_datetime(value):
    if value is None:
        return None
    return timezone.localtime(value, template_timezone())


def parse_date(value):
    if isinstance(value, datetime.date):
        return value
    try:
        return datetime.date.fromisoformat(str(value)[:10])
    except ValueError:
        return value  # leave unexpected values visible rather than dropping them


def date_range(start, stop):
    '''Every date from start up to (not including) stop.'''
    if not start or not stop:
        return ReadOnlyList()
    days = (stop - start).days
    return ReadOnlyList(start + datetime.timedelta(days=offset) for offset in range(max(days, 0)))


def pricing_results(results):
    '''Pricing results (minus the per-camper breakdown) with exact numbers.'''
    return freeze({
        key: number(value) for key, value in (results or {}).items() if key != 'campers'
    })


@dataclass
class EventGraph:
    event: EventVar
    registrations: ReadOnlyList             # completed
    incomplete_registrations: ReadOnlyList
    campers: ReadOnlyList                   # of completed registrations
    payments: ReadOnlyList                  # of completed registrations
    lodgings: ReadOnlyList
    lodging_root: LodgingVar | None
    registration_types: ReadOnlyList
    custom_charge_types: ReadOnlyList
    invitations: ReadOnlyList
    _index: dict = field(default_factory=dict, repr=False)

    def get(self, type_name, obj_id):
        '''Look an object up by type and id (e.g. a preview's sample).'''
        return self._index.get((type_name, obj_id))


def build_event_graph(event, *, registration_ids=None, request=None):
    '''
    Build the graph for one event. `registration_ids` limits registrations (and
    their campers, payments …) to those ids — e.g. just the one a confirmation
    email is for.
    '''
    index = {}

    def keep(var):
        index[(var.type_name, var['id'])] = var
        return var

    def live(queryset):
        return queryset.filter(deleted_at__isnull=True)

    organization_name = event.organization.name if event.organization_id else ''

    registration_types = {
        rt.id: keep(RegistrationTypeVar(id=rt.id, name=rt.name, label=rt.label))
        for rt in live(models.RegistrationType.objects.filter(event=event)).order_by('id')
    }
    custom_charge_types = {
        ct.id: keep(CustomChargeTypeVar(id=ct.id, name=ct.name, label=ct.label))
        for ct in live(models.CustomChargeType.objects.filter(event=event)).order_by('id')
    }

    # Lodging: our own tree of the live nodes, plus the registration form's
    # capacity figures from LodgingTree (which counts every registration).
    lodging_rows = list(live(models.Lodging.objects.filter(event=event)).order_by('id'))
    tree_nodes = {}
    try:
        tree = LodgingTree(event, show_all=True).build()

        def collect(node):
            tree_nodes[node.lodging.id] = node
            for child in node.children:
                collect(child)
        if tree.root:
            collect(tree.root)
    except RuntimeError:
        pass  # e.g. several roots; capacity figures are then unavailable

    lodgings = {}
    for row in lodging_rows:
        node = tree_nodes.get(row.id)
        lodgings[row.id] = keep(LodgingVar(
            id=row.id,
            name=row.name,
            notes=row.notes,
            children_title=row.children_title,
            visible=row.visible,
            capacity=node.capacity if node else row.capacity,
            reserved=node.reserved if node else row.reserved,
            sharing_multiplier=row.sharing_multiplier,
            remaining_capacity=node.remaining_unreserved_capacity if node else None,
            parent=None,
            children=ReadOnlyList(),
            ancestors=ReadOnlyList(),
            path=ReadOnlyList(),
            path_names=ReadOnlyList(),
            full_name='',
            depth=0,
            is_leaf=True,
            is_root=False,
            campers=ReadOnlyList(),
            all_campers=ReadOnlyList(),
            camper_count=0,
        ))
    roots = []
    for row in lodging_rows:
        node = lodgings[row.id]
        parent = lodgings.get(row.parent_id)
        if parent is not None:
            node['parent'] = parent
            parent['children'].append(node)
            parent['is_leaf'] = False
        elif row.parent_id is None:
            roots.append(node)
    lodging_root = roots[0] if len(roots) == 1 else None

    def place(node, ancestors):
        node['ancestors'] = ReadOnlyList(ancestors)
        # The path leaves out the root: it is the camp itself.
        path = [n for n in ancestors[1:]] + ([node] if ancestors else [])
        node['path'] = ReadOnlyList(path)
        node['path_names'] = ReadOnlyList(n['name'] for n in path)
        node['full_name'] = '→'.join(node['path_names'])
        node['depth'] = len(path)
        node['is_root'] = not ancestors
        for child in node['children']:
            place(child, ancestors + [node])
    for root in roots:
        place(root, [])

    # Registrations and everything hanging off them.
    registration_qs = live(models.Registration.objects.filter(event=event))
    if registration_ids is not None:
        registration_qs = registration_qs.filter(id__in=list(registration_ids))
    registration_rows = list(registration_qs.order_by('created_at', 'id'))
    registration_row_ids = [row.id for row in registration_rows]

    registrations = {}
    for row in registration_rows:
        pricing = row.server_pricing_results or {}
        registrations[row.id] = keep(RegistrationVar(
            id=row.id,
            uuid=str(row.uuid),
            created_at=local_datetime(row.created_at),
            updated_at=local_datetime(row.updated_at),
            completed=row.completed,
            registrant_email=row.registrant_email,
            payment_type=row.payment_type,
            attributes=freeze(row.attributes or {}),
            admin_attributes=freeze(row.admin_attributes or {}),
            registration_type=registration_types.get(row.registration_type_id),
            campers=ReadOnlyList(),
            payments=ReadOnlyList(),
            invitation=None,
            pricing=pricing_results(pricing),
            total_owed=money(pricing.get('total', 0)),
            total_paid=Decimal('0.00'),
            balance=money(pricing.get('total', 0)),
            initial_payment=freeze(row.initial_payment) if row.initial_payment else None,
            camper_count=0,
        ))

    camper_rows = list(
        live(models.Camper.objects.filter(registration_id__in=registration_row_ids))
        .order_by('registration_id', 'sequence', 'id')
    )
    campers = {}
    for row in camper_rows:
        registration = registrations[row.registration_id]
        stay = ReadOnlyList(parse_date(day) for day in (row.stay or []))
        dates = [day for day in stay if isinstance(day, datetime.date)]
        camper = keep(CamperVar(
            id=row.id,
            index=len(registration['campers']),
            registration=registration,
            attributes=freeze(row.attributes or {}),
            admin_attributes=freeze(row.admin_attributes or {}),
            lodging=lodgings.get(row.lodging_id),
            lodging_requested=lodgings.get(row.lodging_requested_id),
            lodging_reserved=row.lodging_reserved,
            lodging_shared=row.lodging_shared,
            lodging_shared_with=row.lodging_shared_with,
            lodging_comments=row.lodging_comments,
            stay=stay,
            first_day=min(dates) if dates else None,
            last_day=max(dates) if dates else None,
            pricing=pricing_results(row.server_pricing_results),
            custom_charges=ReadOnlyList(),
            created_at=local_datetime(row.created_at),
        ))
        campers[row.id] = camper
        registration['campers'].append(camper)
        registration['camper_count'] += 1

    for row in live(models.Payment.objects.filter(registration_id__in=registration_row_ids)) \
            .order_by('paid_on', 'id'):
        registration = registrations[row.registration_id]
        payment = keep(PaymentVar(
            id=row.id,
            amount=money(row.amount),
            paid_on=row.paid_on,
            payment_type=row.payment_type,
            notes=row.notes,
            attributes=freeze(row.attributes or {}),
            registration=registration,
            created_at=local_datetime(row.created_at),
        ))
        registration['payments'].append(payment)
    for registration in registrations.values():
        paid = sum((p['amount'] or Decimal('0')) for p in registration['payments'])
        registration['total_paid'] = money(paid)
        registration['balance'] = money((registration['total_owed'] or Decimal('0')) - paid)

    for row in live(models.CustomCharge.objects.filter(camper_id__in=list(campers))) \
            .order_by('id'):
        camper = campers[row.camper_id]
        charge_type = custom_charge_types.get(row.custom_charge_type_id)
        camper['custom_charges'].append(keep(CustomChargeVar(
            id=row.id,
            type=charge_type,
            name=charge_type['name'] if charge_type else '',
            label=charge_type['label'] if charge_type else '',
            amount=money(row.amount),
            notes=row.notes,
            camper=camper,
        )))

    invitations = ReadOnlyList()
    for row in live(models.Invitation.objects.filter(registration_type__event=event)) \
            .order_by('id'):
        registration = registrations.get(row.registration_id)
        invitation = keep(InvitationVar(
            id=row.id,
            recipient_name=row.recipient_name,
            recipient_email=row.recipient_email,
            code=row.invitation_code,
            registration_type=registration_types.get(row.registration_type_id),
            registration=registration,
            sent_time=local_datetime(row.sent_time),
            expiration_time=local_datetime(row.expiration_time),
            register_url=register_url(event.id, row, request),
            redeemed=row.registration_id is not None,
        ))
        invitations.append(invitation)
        if registration is not None:
            registration['invitation'] = invitation

    # Collections templates see: completed registrations only.
    completed = ReadOnlyList(r for r in registrations.values() if r['completed'])
    incomplete = ReadOnlyList(r for r in registrations.values() if not r['completed'])
    completed_campers = ReadOnlyList(c for r in completed for c in r['campers'])
    completed_payments = ReadOnlyList(p for r in completed for p in r['payments'])

    for camper in completed_campers:
        if camper['lodging'] is not None:
            camper['lodging']['campers'].append(camper)

    def gather(node):
        everyone = list(node['campers'])
        for child in node['children']:
            everyone.extend(gather(child))
        node['all_campers'] = ReadOnlyList(everyone)
        node['camper_count'] = len(everyone)
        return everyone
    for root in roots:
        gather(root)

    event_var = keep(EventVar(
        id=event.id,
        name=event.name,
        organization_name=organization_name,
        start=event.start,
        end=event.end,
        registration_start=event.registration_start,
        registration_end=event.registration_end,
        days=date_range(event.start, event.end + datetime.timedelta(days=1) if event.end else None),
        nights=date_range(event.start, event.end),
        default_stay_length=event.default_stay_length,
        is_open=event.is_open(),
        pricing=freeze({key: number(value) for key, value in (event.pricing or {}).items()}),
        template_vars=freeze(event.registration_template_vars or {}),
        register_url=register_url(event.id, None, request),
        confirmation_email_from=event.confirmation_email_from,
        registration_types=ReadOnlyList(registration_types.values()),
        custom_charge_types=ReadOnlyList(custom_charge_types.values()),
        lodging=lodging_root,
        lodgings=ReadOnlyList(),
    ))

    ordered_lodgings = ReadOnlyList()

    def walk(node):
        ordered_lodgings.append(node)
        for child in node['children']:
            walk(child)
    for root in roots:
        walk(root)
    event_var['lodgings'] = ordered_lodgings

    return EventGraph(
        event=event_var,
        registrations=completed,
        incomplete_registrations=incomplete,
        campers=completed_campers,
        payments=completed_payments,
        lodgings=ordered_lodgings,
        lodging_root=lodging_root,
        registration_types=ReadOnlyList(registration_types.values()),
        custom_charge_types=ReadOnlyList(custom_charge_types.values()),
        invitations=invitations,
        _index=index,
    )

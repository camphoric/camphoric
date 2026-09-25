'''
Bulk email recipients (SPEC §8.9, DR-39).

A task's recipients are built from one of three kinds of list:

- `manual`: addresses typed in, one per line (`email` or `Name <email>`);
- `registrations`: the event's registrations (completed, and optionally
  incomplete ones), narrowed by a Jinja filter expression;
- `campers`: those registrations' campers, likewise.

For registrations and campers, Jinja expressions give each recipient's address
and name (with sensible defaults). Every candidate ends up either as a
recipient or as skipped with a reason — `no_address`, `invalid`, `duplicate`
(the same address, case-insensitively, as an earlier recipient) or
`filter_error` (an expression failed for it) — so the admin sees exactly who
will and won't get the email before sending.

Saving the list keeps rows already sent and replaces the unsent ones, so a
resumed or re-run task never emails anyone twice.
'''

from dataclasses import asdict, dataclass, field
from email.utils import parseaddr

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction

from camphoric import models

from .contexts import (
    bulk_email_camper_context, bulk_email_manual_context, bulk_email_registration_context,
    recipient,
)
from .graph import build_event_graph
from .render import compile_expression, expression_error

Kind = models.BulkRecipientKind

CONTEXT_NAMES = {
    Kind.MANUAL: 'bulk_email_manual',
    Kind.REGISTRATIONS: 'bulk_email_registration',
    Kind.CAMPERS: 'bulk_email_camper',
}

DEFAULT_ADDRESS = {
    Kind.REGISTRATIONS: 'registration.registrant_email',
    Kind.CAMPERS: 'camper.attributes.email or registration.registrant_email',
}
DEFAULT_NAME = {
    Kind.REGISTRATIONS: '',
    Kind.CAMPERS: (
        "[camper.attributes.first_name, camper.attributes.last_name] | select | join(' ')"),
}


@dataclass
class Candidate:
    email: str
    name: str
    label: str
    registration: int | None = None
    camper: int | None = None


@dataclass
class Skipped:
    label: str
    reason: str   # no_address | invalid | duplicate | filter_error
    detail: str = ''
    email: str = ''
    registration: int | None = None
    camper: int | None = None


@dataclass
class Resolution:
    recipients: list = field(default_factory=list)
    skipped: list = field(default_factory=list)
    diagnostics: list = field(default_factory=list)

    @property
    def ok(self):
        return not any(d.severity == 'error' for d in self.diagnostics)

    def as_dict(self):
        return {
            'recipients': [asdict(c) for c in self.recipients],
            'skipped': [asdict(s) for s in self.skipped],
            'diagnostics': [d.as_dict() for d in self.diagnostics],
        }


@dataclass
class Criteria:
    '''What a recipient list is built from — a task's fields, saved or not.'''
    kind: str = Kind.MANUAL
    recipient_list: str = ''
    recipient_filter: str = ''
    address_expression: str = ''
    name_expression: str = ''
    include_incomplete: bool = False

    @classmethod
    def of(cls, task):
        return cls(kind=task.recipient_kind, recipient_list=task.recipient_list,
                   recipient_filter=task.recipient_filter,
                   address_expression=task.address_expression,
                   name_expression=task.name_expression,
                   include_incomplete=task.include_incomplete)

    @classmethod
    def from_data(cls, data):
        return cls(
            kind=data.get('recipient_kind') or Kind.MANUAL,
            recipient_list=data.get('recipient_list') or '',
            recipient_filter=data.get('recipient_filter') or '',
            address_expression=data.get('address_expression') or '',
            name_expression=data.get('name_expression') or '',
            include_incomplete=bool(data.get('include_incomplete')),
        )


def expression_diagnostics(criteria):
    '''Syntax errors in the criteria's expressions (checked when a task is saved).'''
    problems = []
    for source, name in ((criteria.recipient_filter, 'recipient_filter'),
                         (criteria.address_expression, 'address_expression'),
                         (criteria.name_expression, 'name_expression')):
        if source.strip():
            _, diagnostic = compile_expression(source, field=name)
            if diagnostic:
                problems.append(diagnostic)
    return problems


def _label_registration(registration):
    return f"Registration #{registration['id']} ({registration['registrant_email']})"


def _label_camper(camper):
    attributes = camper['attributes']
    name = ' '.join(str(attributes.get(k) or '') for k in ('first_name', 'last_name')).strip()
    return f"{name or 'Camper'} (camper #{camper['id']})"


def _valid(address):
    try:
        validate_email(address)
    except ValidationError:
        return False
    return True


class _Collector:
    def __init__(self):
        self.result = Resolution()
        self.seen = {}

    def add(self, email, name, label, **links):
        email = (email or '').strip()
        if not email:
            self.result.skipped.append(Skipped(label, 'no_address', **links))
        elif not _valid(email):
            self.result.skipped.append(Skipped(label, 'invalid', email=email, **links))
        elif email.lower() in self.seen:
            self.result.skipped.append(Skipped(
                label, 'duplicate', f'Same address as {self.seen[email.lower()]}',
                email=email, **links))
        else:
            self.seen[email.lower()] = label
            self.result.recipients.append(Candidate(email, (name or '').strip()[:255], label,
                                                    **links))


def _manual(criteria, collector):
    for number, line in enumerate(criteria.recipient_list.splitlines(), start=1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        name, email = parseaddr(line)
        if not email or '@' not in email:
            collector.result.skipped.append(Skipped(f'Line {number}: {line}', 'invalid',
                                                    email=line))
            continue
        collector.add(email, name, name or email)


def resolve_recipients(event, criteria, *, graph=None, request=None):
    '''Build the recipient list `criteria` describes, from the event's data.'''
    collector = _Collector()
    if criteria.kind == Kind.MANUAL:
        _manual(criteria, collector)
        return collector.result

    expressions = {}
    for name, source, default in (
            ('recipient_filter', criteria.recipient_filter, ''),
            ('address_expression', criteria.address_expression,
             DEFAULT_ADDRESS[criteria.kind]),
            ('name_expression', criteria.name_expression, DEFAULT_NAME[criteria.kind])):
        source = source.strip() or default
        if not source:
            expressions[name] = None
            continue
        compiled, diagnostic = compile_expression(source, field=name)
        if diagnostic:
            collector.result.diagnostics.append(diagnostic)
        expressions[name] = compiled
    if not collector.result.ok:
        return collector.result

    if graph is None:
        graph = build_event_graph(event, request=request)
    registrations = list(graph.registrations)
    if criteria.include_incomplete:
        registrations += list(graph.incomplete_registrations)

    placeholder = recipient('')
    if criteria.kind == Kind.REGISTRATIONS:
        items = [(r, bulk_email_registration_context(graph, r, placeholder),
                  _label_registration(r), {'registration': r['id']})
                 for r in registrations]
    else:
        items = [(c, bulk_email_camper_context(graph, c, placeholder), _label_camper(c),
                  {'registration': r['id'], 'camper': c['id']})
                 for r in registrations for c in r['campers']]

    for _, context, label, links in items:
        try:
            chosen = expressions['recipient_filter'] is None \
                or bool(expressions['recipient_filter'](**context))
            if not chosen:
                continue
            email = expressions['address_expression'](**context)
            name = expressions['name_expression'](**context) \
                if expressions['name_expression'] else ''
        except Exception as exc:  # the expression's own failure, for this item
            collector.result.skipped.append(Skipped(label, 'filter_error',
                                                    expression_error(exc), **links))
            continue
        collector.add('' if email is None else str(email),
                      '' if name is None else str(name), label, **links)
    return collector.result


def resolve_task(task, *, graph=None, request=None):
    return resolve_recipients(task.event, Criteria.of(task), graph=graph, request=request)


def keeps_existing_recipients(task):
    '''Tasks whose recipients were added directly (through the API) keep them.'''
    return task.recipient_kind == Kind.MANUAL and not task.recipient_list.strip()


@transaction.atomic
def materialize_recipients(task, resolution):
    '''
    Save a resolved list as the task's recipients: rows already sent stay,
    unsent rows are replaced. Returns how many were added and how many were
    left out because they'd already been sent to.
    '''
    if keeps_existing_recipients(task):
        return {'added': 0, 'already_sent': 0}
    sent = {email.lower() for email in
            task.recipients.filter(sent_time__isnull=False).values_list('email', flat=True)}
    task.recipients.filter(sent_time__isnull=True).delete()
    rows = [models.BulkEmailRecipient(task=task, email=c.email, full_name=c.name,
                                      registration_id=c.registration, camper_id=c.camper)
            for c in resolution.recipients if c.email.lower() not in sent]
    models.BulkEmailRecipient.objects.bulk_create(rows)
    return {'added': len(rows), 'already_sent': len(resolution.recipients) - len(rows)}


def recipient_context(graph, task, row):
    '''The Jinja variables one copy of the task's email is rendered with.'''
    to = recipient(row.email, row.full_name)
    if task.recipient_kind == Kind.REGISTRATIONS and row.registration_id:
        return bulk_email_registration_context(
            graph, graph.get('registration', row.registration_id), to)
    if task.recipient_kind == Kind.CAMPERS and row.camper_id:
        return bulk_email_camper_context(graph, graph.get('camper', row.camper_id), to)
    return bulk_email_manual_context(graph, to)

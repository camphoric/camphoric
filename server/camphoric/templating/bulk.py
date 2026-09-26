'''
Group email recipients (SPEC §8.9, DR-45).

A group email's recipients are built from one of three sources:

- `manual`: addresses typed in, one per line (`email` or `Name <email>`);
- `registrations`: the event's registrations (completed, and optionally
  incomplete ones), narrowed by recipient rules (templating.rules) and a Jinja
  filter expression;
- `campers`: those registrations' campers, likewise.

For registrations and campers, Jinja expressions give each recipient's address
and name (with sensible defaults). Every candidate ends up either as a
recipient or as skipped with a reason — `no_address`, `invalid`, `duplicate`
(the same address, case-insensitively, as an earlier recipient) or
`filter_error` (an expression failed for it) — so the admin sees exactly who
will and won't get the email before sending. Each recipient has a key
(`registration:<id>`, `camper:<id>`, `address:<email>`) that a send records.
'''

from dataclasses import asdict, dataclass, field
from email.utils import parseaddr

from django.core.exceptions import ValidationError
from django.core.validators import validate_email

from camphoric import models

from .contexts import (
    bulk_email_camper_context, bulk_email_manual_context, bulk_email_registration_context,
    recipient,
)
from .graph import build_event_graph
from .render import compile_expression, expression_error
from .rules import compile_rules

Kind = models.EmailRecipientSource

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
    # Who this is in the list: registration:<id>, camper:<id> or address:<email>.
    key: str = ''


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
    # With only_keys: the keys no longer in the event's data.
    missing: list = field(default_factory=list)

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
    '''What a recipient list is built from — a template's fields, saved or not.'''
    kind: str = Kind.MANUAL
    recipient_list: str = ''
    recipient_filter: str = ''
    address_expression: str = ''
    name_expression: str = ''
    include_incomplete: bool = False
    # Rule-builder rules (templating.rules); they and the filter expression must both pass.
    rules: dict | None = None

    @classmethod
    def of_template(cls, template):
        return cls(kind=template.recipient_source, recipient_list=template.recipient_list,
                   recipient_filter=template.filter_expression,
                   address_expression=template.address_expression,
                   name_expression=template.name_expression,
                   include_incomplete=template.include_incomplete, rules=template.filter)

    @classmethod
    def from_request(cls, data):
        '''Criteria as the email API names them (a template's fields, saved or not).'''
        return cls(
            kind=data.get('recipient_source') or Kind.REGISTRATIONS,
            recipient_list=data.get('recipient_list') or '',
            recipient_filter=data.get('filter_expression') or '',
            address_expression=data.get('address_expression') or '',
            name_expression=data.get('name_expression') or '',
            include_incomplete=bool(data.get('include_incomplete')),
            rules=data.get('filter') or None,
        )


def expression_diagnostics(criteria):
    '''Syntax errors in the criteria's expressions (checked when a template is saved).'''
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

    def add(self, email, name, label, key='', **links):
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
                                                    key=key or f'address:{email.lower()}',
                                                    **links))


def _manual(criteria, collector, only_keys=None):
    for number, line in enumerate(criteria.recipient_list.splitlines(), start=1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        name, email = parseaddr(line)
        if not email or '@' not in email:
            if only_keys is None:
                collector.result.skipped.append(Skipped(f'Line {number}: {line}', 'invalid',
                                                        email=line))
            continue
        if only_keys is not None and f'address:{email.lower()}' not in only_keys:
            continue
        collector.add(email, name, name or email)


def _missing(result, only_keys):
    if only_keys is not None:
        found = {c.key for c in result.recipients} | {
            f"{'camper' if s.camper else 'registration'}:{s.camper or s.registration}"
            for s in result.skipped if s.registration}
        result.missing = sorted(set(only_keys) - found)
    return result


def resolve_recipients(event, criteria, *, graph=None, request=None, only_keys=None):
    '''
    Build the recipient list `criteria` describes, from the event's data. With
    `only_keys` (a batch's reviewed recipients), just those — the filters were
    applied when they were chosen — and `missing` lists any that are gone.
    '''
    only_keys = set(only_keys) if only_keys is not None else None
    collector = _Collector()
    if criteria.kind == Kind.MANUAL:
        _manual(criteria, collector, only_keys)
        return _missing(collector.result, only_keys)

    rules = lambda context: True  # noqa: E731
    if only_keys is None:
        compiled_rules, problems = compile_rules(criteria.rules)
        collector.result.diagnostics += problems
        rules = compiled_rules or rules
    expressions = {}
    for name, source, default in (
            ('recipient_filter', criteria.recipient_filter if only_keys is None else '', ''),
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
        items = [(f"registration:{r['id']}", bulk_email_registration_context(graph, r, placeholder),
                  _label_registration(r), {'registration': r['id']})
                 for r in registrations]
    else:
        items = [(f"camper:{c['id']}", bulk_email_camper_context(graph, c, placeholder),
                  _label_camper(c), {'registration': r['id'], 'camper': c['id']})
                 for r in registrations for c in r['campers']]
    if only_keys is not None:
        items = [item for item in items if item[0] in only_keys]

    for key, context, label, links in items:
        try:
            chosen = rules(context) and (expressions['recipient_filter'] is None
                                         or bool(expressions['recipient_filter'](**context)))
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
                      '' if name is None else str(name), label, key=key, **links)
    return _missing(collector.result, only_keys)


def candidate_context(graph, source, candidate):
    '''The Jinja variables one copy of a group email renders with (SPEC DR-45).'''
    to = recipient(candidate.email, candidate.name)
    if source == Kind.REGISTRATIONS and candidate.registration:
        return bulk_email_registration_context(
            graph, graph.get('registration', candidate.registration), to)
    if source == Kind.CAMPERS and candidate.camper:
        return bulk_email_camper_context(graph, graph.get('camper', candidate.camper), to)
    return bulk_email_manual_context(graph, to)

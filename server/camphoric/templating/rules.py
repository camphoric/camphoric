'''
Recipient rules for group email (SPEC §8.9, DR-45): the no-code filter an admin
builds field by field — "balance > 0", "meals is Vegetarian" — as JSON:

    {"combinator": "and" | "or", "rules": [{"field": "registration.balance",
                                            "op": "gt", "value": 0}, ...]}

A field is a dotted path into the same variables the Jinja expressions see
(`registration`, `camper`), so a rule reads a value exactly as `{{ ... }}`
would. `recipient_fields` lists the fields an event's recipients can be chosen
by, grouped and typed, for the rule builder.
'''

from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from camphoric import models

from . import describe
from .render import Diagnostic

# The operators each kind of field offers (the rule builder shows the same).
OPERATORS = {
    'string': ('contains', 'not_contains', 'is', 'is_not', 'is_set', 'is_not_set'),
    'number': ('eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'is_set', 'is_not_set'),
    'boolean': ('is_true', 'is_false'),
    'enum': ('is', 'is_not', 'any_of', 'is_set', 'is_not_set'),
    'date': ('before', 'after', 'on', 'is_set', 'is_not_set'),
    'list': ('contains', 'any_of', 'is_set', 'is_not_set'),
}
NO_VALUE = {'is_set', 'is_not_set', 'is_true', 'is_false'}
ALL_OPERATORS = {op for ops in OPERATORS.values() for op in ops}


def empty_filter():
    return {'combinator': 'and', 'rules': []}


def has_rules(filter_):
    return bool(isinstance(filter_, dict) and filter_.get('rules'))


# --- Evaluation --------------------------------------------------------------------

def lookup(context, path):
    '''The value at a dotted path in the context (None when any step is missing).'''
    value = context
    for name in path.split('.'):
        if isinstance(value, dict):
            value = value.get(name)
        else:
            value = getattr(value, name, None)
        if value is None:
            return None
    return value


def _is_set(value):
    return value is not None and value != '' and value != [] and value != {}


def _number(value):
    if isinstance(value, bool) or value is None or value == '':
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value:
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def _text(value):
    return '' if value is None else str(value).strip().lower()


def _as_list(value):
    return value if isinstance(value, (list, tuple)) else [value]


def matches(rule, context):
    '''Whether one rule holds for one recipient's variables.'''
    op, wanted = rule.get('op'), rule.get('value')
    value = lookup(context, rule.get('field') or '')
    if op == 'is_set':
        return _is_set(value)
    if op == 'is_not_set':
        return not _is_set(value)
    if op == 'is_true':
        return value is True
    if op == 'is_false':
        return not value
    if op in ('eq', 'ne', 'gt', 'lt', 'gte', 'lte'):
        have, want = _number(value), _number(wanted)
        if have is None or want is None:
            return op == 'ne' and have != want
        return {'eq': have == want, 'ne': have != want, 'gt': have > want, 'lt': have < want,
                'gte': have >= want, 'lte': have <= want}[op]
    if op in ('before', 'after', 'on'):
        have, want = _date(value), _date(wanted)
        if have is None or want is None:
            return False
        return {'before': have < want, 'after': have > want, 'on': have == want}[op]
    if isinstance(value, (list, tuple)):
        # A multi-choice answer: "contains" one value, or "any of" several.
        have = {_text(v) for v in value}
        if op == 'contains':
            return _text(wanted) in have
        if op == 'any_of':
            return bool(have & {_text(w) for w in _as_list(wanted)})
        return False
    have = _text(value)
    if op == 'contains':
        return _text(wanted) in have
    if op == 'not_contains':
        return _text(wanted) not in have
    if op == 'is':
        return have == _text(wanted)
    if op == 'is_not':
        return have != _text(wanted)
    if op == 'any_of':
        return have in {_text(w) for w in _as_list(wanted)}
    return False


def compile_rules(filter_):
    '''
    Check a filter's structure and return (predicate, diagnostics). The
    predicate takes a recipient's variables; with no rules, it chooses everyone.
    '''
    problems = []

    def problem(message):
        problems.append(Diagnostic(severity='error', kind='syntax', message=message,
                                   field='filter'))

    if filter_ in (None, ''):
        filter_ = empty_filter()
    if not isinstance(filter_, dict):
        problem('The filter must be an object with "combinator" and "rules".')
        return None, problems
    combinator = filter_.get('combinator', 'and')
    rules = filter_.get('rules') or []
    if combinator not in ('and', 'or'):
        problem('"combinator" must be "and" or "or".')
    if not isinstance(rules, list):
        problem('"rules" must be a list.')
        rules = []
    for number, rule in enumerate(rules, start=1):
        if not isinstance(rule, dict) or not isinstance(rule.get('field'), str) \
                or not rule['field']:
            problem(f'Rule {number} needs a field.')
        elif rule.get('op') not in ALL_OPERATORS:
            problem(f'Rule {number} has an unknown operator {rule.get("op")!r}.')
        elif rule['op'] not in NO_VALUE and rule.get('value') in (None, '', []):
            problem(f'Rule {number} ({rule["field"]}) needs a value.')
    if problems:
        return None, problems
    if not rules:
        return (lambda context: True), []
    combine = all if combinator == 'and' else any
    return (lambda context: combine(matches(rule, context) for rule in rules)), []


# --- The field catalog -------------------------------------------------------------

def _field(key, label, group, kind, options=None):
    entry = {'key': key, 'label': label, 'group': group, 'type': kind}
    if options:
        entry['options'] = [{'value': value, 'label': str(value)} for value in options]
    return entry


def _kind(entry):
    '''The rule builder's kind for a describe field, or None to leave it out.'''
    kind = entry.get('type', 'any')
    if kind.startswith('list<'):
        inner = kind[5:-1]
        return 'list' if inner in ('string', 'number', 'bool', 'any') else None
    if kind == 'number':
        return 'number'
    if kind == 'bool':
        return 'boolean'
    if kind in ('string', 'any'):
        if entry.get('enum'):
            return 'enum'
        if entry.get('format') in ('date', 'date-time'):
            return 'date'
        return 'string'
    return None


def _flatten(types, type_name, prefix, group, label_prefix='', depth=0):
    fields = []
    for entry in types.get(type_name, {}).get('fields', []):
        key = f'{prefix}.{entry["name"]}'
        label = f'{label_prefix}{entry.get("title") or describe.humanize(entry["name"])}'
        nested = entry.get('type', '')
        if nested in types and depth < 2:
            fields += _flatten(types, nested, key, group, f'{label} › ', depth + 1)
            continue
        kind = _kind(entry)
        if kind:
            fields.append(_field(key, label, group, kind, entry.get('enum')))
    return fields


def recipient_fields(event, source):
    '''The fields `source`'s recipients can be chosen by, for the rule builder.'''
    types = describe.event_types(event)
    type_labels = list(event.registrationtype_set.filter(deleted_at__isnull=True)
                       .values_list('label', flat=True))
    fields = [
        _field('registration.registrant_email', 'Registrant email', 'Registration', 'string'),
        _field('registration.payment_type', 'Payment type', 'Registration', 'enum',
               [choice for choice, _ in models.PaymentType.choices]),
        _field('registration.registration_type.label', 'Registration type', 'Registration',
               'enum', type_labels),
        _field('registration.created_at', 'Registered on', 'Registration', 'date'),
        _field('registration.balance', 'Balance', 'Registration', 'number'),
        _field('registration.total_owed', 'Total owed', 'Registration', 'number'),
        _field('registration.total_paid', 'Total paid', 'Registration', 'number'),
        _field('registration.camper_count', 'Number of campers', 'Registration', 'number'),
        _field('registration.completed', 'Completed', 'Registration', 'boolean'),
        *_flatten(types, 'attributes:registration', 'registration.attributes',
                  'Registration answers'),
        *_flatten(types, 'admin_attributes:registration', 'registration.admin_attributes',
                  'Registration admin fields'),
        *_flatten(types, 'pricing:registration', 'registration.pricing', 'Registration pricing'),
    ]
    if source == models.EmailRecipientSource.CAMPERS:
        fields += [
            _field('camper.lodging.name', 'Lodging', 'Camper', 'string'),
            _field('camper.lodging.full_name', 'Lodging (full path)', 'Camper', 'string'),
            _field('camper.first_day', 'First day', 'Camper', 'date'),
            _field('camper.last_day', 'Last day', 'Camper', 'date'),
            _field('camper.lodging_shared', 'Sharing lodging', 'Camper', 'boolean'),
            *_flatten(types, 'attributes:camper', 'camper.attributes', 'Camper answers'),
            *_flatten(types, 'admin_attributes:camper', 'camper.admin_attributes',
                      'Camper admin fields'),
            *_flatten(types, 'pricing:camper', 'camper.pricing', 'Camper pricing'),
        ]
    return fields

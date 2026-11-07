'''
The describe payload (SPEC §9.3, DR-36): everything a template author can use
for one event — the registry's types, contexts, filters, tests and tags, plus
types built from this event's own forms and pricing:

  attributes:registration / attributes:camper  the form questions
  admin_attributes:registration / :camper      admin-only fields
  attributes:payment                           extra payment fields
  pricing:registration / pricing:camper        pricing components
  pricing:event                                the event's pricing variables

Nested objects get their own types (`attributes:camper.emergency_contact`),
array items too (`attributes:camper.parking_passes.*`). A field whose key isn't
a valid Jinja name (or clashes with a dict method) is marked
`identifier: false`, so the editor writes `camper.attributes['key']`. These
values are dicts, so each type's `base` is `dict` (it has dict's methods).
'''

import copy
import re
from types import MappingProxyType

from deepmerge import always_merger

from . import registry
from .values import DictType

DICT_METHODS = frozenset(dir(dict))
JINJA_KEYWORDS = frozenset({
    'and', 'or', 'not', 'in', 'is', 'if', 'else', 'elif', 'for', 'true', 'false', 'none',
    'True', 'False', 'None', 'loop', 'block', 'endblock',
})
IDENTIFIER = re.compile(r'[A-Za-z_][A-Za-z0-9_]*')
MAX_DEPTH = 4


def is_identifier(key):
    return bool(IDENTIFIER.fullmatch(key)) and key not in DICT_METHODS \
        and key not in JINJA_KEYWORDS


def humanize(key):
    words = re.sub(r'[_-]+', ' ', key).strip()
    return words[:1].upper() + words[1:] if words else key


class SchemaWalker:
    '''Turn JSON Schemas into describe types, following every branch.'''

    def __init__(self, types, root, open_types=None):
        self.types = types
        self.root = root
        # Types whose schema allows keys it doesn't list (`additionalProperties`).
        self.open_types = open_types if open_types is not None else set()

    def deref(self, schema, seen=()):
        while isinstance(schema, dict) and isinstance(schema.get('$ref'), str):
            ref = schema['$ref']
            if ref in seen or not ref.startswith('#/'):
                return {}
            seen = seen + (ref,)
            node = self.root
            for part in ref[2:].split('/'):
                node = node.get(part, {}) if isinstance(node, dict) else {}
            siblings = {k: v for k, v in schema.items() if k != '$ref'}
            schema = {**node, **siblings}
        return schema if isinstance(schema, dict) else {}

    @staticmethod
    def branches(schema):
        '''A (dereferenced) schema's conditional and combined branches.'''
        found = [dependency for dependency in (schema.get('dependencies') or {}).values()
                 if isinstance(dependency, dict)]
        for keyword in ('allOf', 'oneOf', 'anyOf'):
            found.extend(schema.get(keyword) or [])
        found.extend(b for b in (schema.get('then'), schema.get('else')) if b)
        return found

    def is_object(self, schema):
        schema = self.deref(schema)
        return schema.get('type') == 'object' or bool(schema.get('properties'))

    def properties(self, schema, depth=0):
        '''All properties a schema can have, including conditional branches.'''
        schema = self.deref(schema)
        found = {}
        for key, child in (schema.get('properties') or {}).items():
            found.setdefault(key, child)
        # An object several branches give their own questions: every definition
        # of it, combined in one flat allOf once all the branches are read.
        objects = {}
        if depth < MAX_DEPTH:
            for branch in self.branches(schema):
                for key, child in self.properties(branch, depth + 1).items():
                    current = found.get(key)
                    if current is not None and self.is_object(current) \
                            and self.is_object(child):
                        objects.setdefault(key, [current]).append(child)
                        continue
                    resolved = self.deref(current or {})
                    if current is None or not (resolved.get('title') or resolved.get('type')):
                        # Prefer a definition that has a title/type over a bare
                        # branch discriminator like {"enum": [true]}.
                        found[key] = child
        for key, definitions in objects.items():
            first = self.deref(definitions[0])
            found[key] = {
                **{k: first[k] for k in ('title', 'description', 'type') if k in first},
                'allOf': definitions,
            }
        return found

    def allows_other_keys(self, schema, depth=0):
        '''Whether a schema, or any of its branches, allows keys it doesn't list.'''
        schema = self.deref(schema)
        if schema.get('additionalProperties', False) is not False \
                or schema.get('patternProperties'):
            return True
        return depth < MAX_DEPTH and any(
            self.allows_other_keys(branch, depth + 1) for branch in self.branches(schema))

    def add_type(self, name, doc, schema, *, exclude=(), depth=0, extra_fields=()):
        if self.allows_other_keys(schema):
            self.open_types.add(name)
        fields = [*extra_fields]
        for key, child in self.properties(schema).items():
            if key in exclude:
                continue
            fields.append(self.field(name, key, child, depth))
        self.types[name] = {'doc': doc, 'fields': fields, 'base': 'dict'}

    def field(self, owner, key, schema, depth):
        schema = self.deref(schema)
        title = schema.get('title') or humanize(key)
        entry = {
            'name': key,
            'type': self.type_of(owner, key, schema, depth),
            'doc': schema.get('description') or title,
            'title': title,
            'identifier': is_identifier(key),
        }
        if isinstance(schema.get('enum'), list):
            entry['enum'] = schema['enum']
        elif schema.get('type') == 'array':
            # A multi-choice answer: its choices.
            items = self.deref(schema.get('items') or {})
            if isinstance(items.get('enum'), list):
                entry['enum'] = items['enum']
        if schema.get('format'):
            entry['format'] = schema['format']
        return entry

    def type_of(self, owner, key, schema, depth):
        kind = schema.get('type')
        if isinstance(kind, list):
            kind = next((k for k in kind if k != 'null'), None)
        nested = f'{owner}.{key}'
        if kind == 'object' or (kind is None and self.properties(schema)):
            if depth < MAX_DEPTH:
                self.add_type(nested, schema.get('title') or humanize(key), schema,
                              depth=depth + 1)
                return nested
            return 'dict'
        if kind == 'array':
            items = self.deref(schema.get('items') or {})
            if items.get('type') == 'object' or self.properties(items):
                if depth < MAX_DEPTH:
                    self.add_type(f'{nested}.*', items.get('title') or humanize(key), items,
                                  depth=depth + 1)
                    return f'list<{nested}.*>'
                return 'list<dict>'
            return f'list<{self.scalar(items.get("type"), items)}>'
        return self.scalar(kind, schema)

    @staticmethod
    def scalar(kind, schema):
        if kind in ('integer', 'number'):
            return 'number'
        if kind == 'boolean':
            return 'bool'
        if kind == 'string':
            return 'string'
        if schema.get('enum'):
            values = schema['enum']
            if all(isinstance(v, bool) for v in values):
                return 'bool'
            if all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in values):
                return 'number'
            return 'string'
        return 'any'


def _pricing_fields(components, doc):
    fields = []
    for component in components or []:
        var = component.get('var') if isinstance(component, dict) else None
        if not var:
            continue
        label = component.get('label') or humanize(var)
        fields.append({'name': var, 'type': 'number', 'doc': f'{doc}: {label}', 'title': label,
                       'identifier': is_identifier(var)})
    return fields


def _unique(fields):
    seen, result = set(), []
    for entry in fields:
        if entry['name'] not in seen:
            seen.add(entry['name'])
            result.append(entry)
    return result


# Form keys the registration flow keeps out of `attributes` (they have their
# own fields), and pricing lines the server adds to every event's results.
REGISTRATION_FORM_EXCLUDED = ('campers', 'registrant_email')
CAMPER_FORM_EXCLUDED = ('lodging',)
SERVER_PRICING_LINES = ('promo', 'total', 'overridden')


def event_types(event, *, registration_types=None, open_types=None):
    '''
    The describe types built from this event's forms and pricing.
    `registration_types` are the event's live ones, when the caller has them
    (otherwise they're queried); the names of types whose schema allows keys
    it doesn't list are added to `open_types`.
    '''
    types = {}
    open_types = open_types if open_types is not None else set()
    registration_schema = event.registration_schema or {}
    camper_schema = event.camper_schema or {}

    SchemaWalker(types, registration_schema, open_types).add_type(
        'attributes:registration', 'Answers to the registration form.', registration_schema,
        exclude=REGISTRATION_FORM_EXCLUDED)

    # Camper forms $ref the registration form's definitions (e.g. address).
    camper_root = {
        **camper_schema,
        'definitions': {
            **(registration_schema.get('definitions') or {}),
            **(camper_schema.get('definitions') or {}),
        },
    }
    SchemaWalker(types, camper_root, open_types).add_type(
        'attributes:camper', "Answers to the camper form.", camper_root,
        exclude=CAMPER_FORM_EXCLUDED)

    # Fields only some registration types add (via their schema overrides).
    if registration_types is None:
        registration_types = event.registrationtype_set.filter(deleted_at__isnull=True)
    for registration_type in registration_types:
        for type_name, overrides, root in (
            ('attributes:registration', registration_type.registration_schema_overrides,
             registration_schema),
            ('attributes:camper', registration_type.camper_schema_overrides, camper_root),
        ):
            walker = SchemaWalker(types, root, open_types)
            known = {f['name'] for f in types[type_name]['fields']}
            for key, child in walker.properties(overrides or {}).items():
                if key in known or key in REGISTRATION_FORM_EXCLUDED + CAMPER_FORM_EXCLUDED:
                    continue
                entry = walker.field(type_name, key, child, 0)
                entry['doc'] = f"{entry['doc']} (registration type: {registration_type.label})"
                types[type_name]['fields'].append(entry)

    for scope, admin_schema in (
        ('registration', event.registration_admin_schema),
        ('camper', event.camper_admin_schema),
    ):
        combined = {
            'type': 'object',
            'properties': {
                key: entry['data'] for key, entry in (admin_schema or {}).items()
                if isinstance(entry, dict) and isinstance(entry.get('data'), dict)
            },
        }
        SchemaWalker(types, combined, open_types).add_type(
            f'admin_attributes:{scope}', f'Admin-only fields for a {scope}.', combined)

    payment_schema = event.payment_schema or {}
    SchemaWalker(types, payment_schema, open_types).add_type(
        'attributes:payment', 'Extra payment details.', payment_schema)

    camper_pricing = _pricing_fields(event.camper_pricing_logic, 'Camper pricing')
    types['pricing:camper'] = {'doc': "A camper's pricing results.", 'fields': camper_pricing,
                               'base': 'dict'}
    registration_pricing = _unique([
        *_pricing_fields(event.registration_pricing_logic, 'Registration pricing'),
        *[{**f, 'doc': f"{f['doc']} (all campers)"} for f in camper_pricing],
        {'name': 'total', 'type': 'number', 'doc': 'Total charged.', 'title': 'Total',
         'identifier': True},
    ])
    types['pricing:registration'] = {'doc': "A registration's pricing results.",
                                     'fields': registration_pricing, 'base': 'dict'}
    types['pricing:event'] = {
        'doc': "The event's pricing variables.",
        'fields': [
            {'name': key, 'type': 'number' if isinstance(value, (int, float)) else 'any',
             'doc': f'Pricing variable {key}', 'title': humanize(key),
             'identifier': is_identifier(key)}
            for key, value in (event.pricing or {}).items()
        ],
        'base': 'dict',
    }
    return types


# How a warning names each type's dict (SPEC §9.3): as a template reaches it.
DICT_TYPE_LABELS = {
    'attributes:registration': 'registration.attributes',
    'attributes:camper': 'camper.attributes',
    'attributes:payment': 'payment.attributes',
    'admin_attributes:registration': 'registration.admin_attributes',
    'admin_attributes:camper': 'camper.admin_attributes',
    'pricing:registration': 'registration.pricing',
    'pricing:camper': 'camper.pricing',
    'pricing:event': 'event.pricing',
}
EXTRA_KEYS = {
    'attributes:registration': REGISTRATION_FORM_EXCLUDED,
    'attributes:camper': CAMPER_FORM_EXCLUDED,
    'pricing:registration': SERVER_PRICING_LINES,
    'pricing:camper': SERVER_PRICING_LINES,
}
LIST_TYPE = re.compile(r'list<(.+)>')


def _with_overrides(event, registration_type):
    '''
    The event with a registration type's schema overrides merged into its forms,
    as the registration endpoint merges them (deeply), never saved.
    '''
    merged = copy.copy(event)
    merged.registration_schema = always_merger.merge(
        copy.deepcopy(event.registration_schema or {}),
        copy.deepcopy(registration_type.registration_schema_overrides or {}))
    merged.camper_schema = always_merger.merge(
        copy.deepcopy(event.camper_schema or {}),
        copy.deepcopy(registration_type.camper_schema_overrides or {}))
    return merged


def _dict_types(event):
    '''The `DictType`s of one set of forms (no registration type's overrides).'''
    open_types = set()
    types = event_types(event, registration_types=[], open_types=open_types)

    def build(name, label):
        entry_fields = types[name]['fields']
        names = {entry['name'] for entry in entry_fields} | set(EXTRA_KEYS.get(name, ()))
        # A form with no questions listed (none, or a free-form object) can't be checked.
        checked = name not in open_types and (bool(entry_fields) or name.startswith('pricing:'))
        children = {}
        for entry in entry_fields:
            match = LIST_TYPE.fullmatch(entry['type'])
            child = match.group(1) if match else entry['type']
            if child in types:
                path = f"{label}.{entry['name']}{'[n]' if match else ''}"
                children[entry['name']] = build(child, path)
        return DictType(name=name, label=label, fields=frozenset(names) if checked else None,
                        children=MappingProxyType(children))

    return {name: build(name, label) for name, label in DICT_TYPE_LABELS.items()}


def event_dict_types(event, *, registration_types=None):
    '''
    The `DictType` of each of this event's data dicts (by describe type name),
    for the graph to tag them with, so a template reading a key the event
    doesn't define is warned (SPEC §9.3). A pricing type lists every line; a
    form type is checked only when its schema lists its questions and allows
    no others. A form's keys are those of the event's own form and of each
    registration type's, with its overrides merged in.
    '''
    if registration_types is None:
        registration_types = event.registrationtype_set.filter(deleted_at__isnull=True)
    dict_types = _dict_types(event)
    for registration_type in registration_types:
        if registration_type.registration_schema_overrides \
                or registration_type.camper_schema_overrides:
            overridden = _dict_types(_with_overrides(event, registration_type))
            dict_types = {name: dict_type.union(overridden[name])
                          for name, dict_type in dict_types.items()}
    return dict_types


def describe(event):
    '''The full describe payload for an event (see the module docstring).'''
    types = {spec.name: spec.as_dict() for spec in registry.TYPES}
    types.update(event_types(event))
    return {
        'contexts': {spec.name: spec.as_dict() for spec in registry.CONTEXTS},
        'types': types,
        'filters': [spec.as_dict() for spec in registry.FILTERS],
        'tests': [spec.as_dict() for spec in registry.TESTS],
        'tags': [spec.as_dict() for spec in registry.TAGS],
        'globals': [spec.as_dict() for spec in registry.GLOBALS],
    }

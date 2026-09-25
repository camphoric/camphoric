'''
The describe payload (SPEC §9.3, DR-37): everything a template author can use
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
`identifier: false`, so the editor writes `camper.attributes['key']`.
'''

import re

from . import registry

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

    def __init__(self, types, root):
        self.types = types
        self.root = root

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

    def properties(self, schema, depth=0):
        '''All properties a schema can have, including conditional branches.'''
        schema = self.deref(schema)
        found = {}
        for key, child in (schema.get('properties') or {}).items():
            found.setdefault(key, child)
        branches = []
        for dependency in (schema.get('dependencies') or {}).values():
            if isinstance(dependency, dict):
                branches.append(dependency)
        for keyword in ('allOf', 'oneOf', 'anyOf'):
            branches.extend(schema.get(keyword) or [])
        branches.extend(b for b in (schema.get('then'), schema.get('else')) if b)
        if depth < MAX_DEPTH:
            for branch in branches:
                for key, child in self.properties(branch, depth + 1).items():
                    # Prefer a definition that has a title/type over a bare
                    # branch discriminator like {"enum": [true]}.
                    current = self.deref(found.get(key, {}))
                    if key not in found or not (current.get('title') or current.get('type')):
                        found[key] = child
        return found

    def add_type(self, name, doc, schema, *, exclude=(), depth=0, extra_fields=()):
        fields = [*extra_fields]
        for key, child in self.properties(schema).items():
            if key in exclude:
                continue
            fields.append(self.field(name, key, child, depth))
        self.types[name] = {'doc': doc, 'fields': fields}

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


def event_types(event):
    '''The describe types built from this event's forms and pricing.'''
    types = {}
    registration_schema = event.registration_schema or {}
    camper_schema = event.camper_schema or {}

    SchemaWalker(types, registration_schema).add_type(
        'attributes:registration', 'Answers to the registration form.', registration_schema,
        exclude=('campers', 'registrant_email'))

    # Camper forms $ref the registration form's definitions (e.g. address).
    camper_root = {
        **camper_schema,
        'definitions': {
            **(registration_schema.get('definitions') or {}),
            **(camper_schema.get('definitions') or {}),
        },
    }
    SchemaWalker(types, camper_root).add_type(
        'attributes:camper', "Answers to the camper form.", camper_root, exclude=('lodging',))

    # Fields only some registration types add (via their schema overrides).
    for registration_type in event.registrationtype_set.filter(deleted_at__isnull=True):
        for type_name, overrides, root in (
            ('attributes:registration', registration_type.registration_schema_overrides,
             registration_schema),
            ('attributes:camper', registration_type.camper_schema_overrides, camper_root),
        ):
            walker = SchemaWalker(types, root)
            known = {f['name'] for f in types[type_name]['fields']}
            for key, child in walker.properties(overrides or {}).items():
                if key in known or key in ('campers', 'registrant_email', 'lodging'):
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
        SchemaWalker(types, combined).add_type(
            f'admin_attributes:{scope}', f'Admin-only fields for a {scope}.', combined)

    payment_schema = event.payment_schema or {}
    SchemaWalker(types, payment_schema).add_type(
        'attributes:payment', 'Extra payment details.', payment_schema)

    camper_pricing = _pricing_fields(event.camper_pricing_logic, 'Camper pricing')
    types['pricing:camper'] = {'doc': "A camper's pricing results.", 'fields': camper_pricing}
    registration_pricing = _unique([
        *_pricing_fields(event.registration_pricing_logic, 'Registration pricing'),
        *[{**f, 'doc': f"{f['doc']} (all campers)"} for f in camper_pricing],
        {'name': 'total', 'type': 'number', 'doc': 'Total charged.', 'title': 'Total',
         'identifier': True},
        {'name': 'handling', 'type': 'number', 'doc': 'Electronic payment handling charge '
         '(when paying electronically).', 'title': 'Handling', 'identifier': True,
         'nullable': True},
    ])
    types['pricing:registration'] = {'doc': "A registration's pricing results.",
                                     'fields': registration_pricing}
    types['pricing:event'] = {
        'doc': "The event's pricing variables.",
        'fields': [
            {'name': key, 'type': 'number' if isinstance(value, (int, float)) else 'any',
             'doc': f'Pricing variable {key}', 'title': humanize(key),
             'identifier': is_identifier(key)}
            for key, value in (event.pricing or {}).items()
        ],
    }
    return types


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

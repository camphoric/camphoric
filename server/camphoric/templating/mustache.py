'''
Convert a Mustache confirmation or invitation email to Jinja (SPEC DR-45).

Mustache emails saw a fixed set of variables (the "From Mustache emails" help
guide lists them); Jinja emails see the event's variables. This rewrites one
into the other so the email reads the same:

- the template is tokenized with chevron, the library that rendered it, so it
  is read exactly as Mustache read it (including the lines it dropped around a
  section tag alone on its line);
- each name is resolved through the section scopes the way Mustache resolved
  it, innermost first, and mapped to its Jinja path (`{{first_name}}` inside
  `{{#campers}}` becomes `{{ camper.attributes.first_name }}`);
- a section becomes a loop over a list, or an `if` on anything else (an object
  also becomes the scope for the names inside it); whether a value is a list or
  an object comes from the event's form schemas;
- an inverted section becomes `if not` (chevron drops comments).

What can't be converted (a partial, changed delimiters) raises
MustacheConversionError. A name that no scope knows keeps its path, so the
template's checks report it rather than hiding it.
'''

from dataclasses import dataclass, field
import re

import chevron.tokenizer


class MustacheConversionError(Exception):
    pass


# --- The shapes of the values Mustache saw -------------------------------------

@dataclass
class Shape:
    '''What a value is: a list (of `item`), an object (with `fields`), or a scalar.'''
    kind: str  # 'list' | 'object' | 'scalar' | 'unknown'
    item: 'Shape | None' = None
    fields: dict = field(default_factory=dict)
    # For an object: fields named here map to a Jinja expression of their own,
    # given the object's expression; other names go under `fallback`.
    special: dict = field(default_factory=dict)
    fallback: str | None = None
    # Always there (the registration, a camper): its fields can be read directly.
    # Anything else (a form answer, the initial payment) may be missing, which
    # Mustache printed as nothing; its fields are read through `(value or {})`.
    sure: bool = False

    def field(self, name):
        return self.fields.get(name, UNKNOWN)


UNKNOWN = Shape('unknown')
SCALAR = Shape('scalar')


def _deref(schema, root, seen=()):
    while isinstance(schema, dict) and isinstance(schema.get('$ref'), str):
        ref = schema['$ref']
        if ref in seen or not ref.startswith('#/'):
            return {}
        seen += (ref,)
        node = root
        for part in ref[2:].split('/'):
            node = node.get(part, {}) if isinstance(node, dict) else {}
        schema = {**node, **{k: v for k, v in schema.items() if k != '$ref'}}
    return schema if isinstance(schema, dict) else {}


def _properties(schema, root):
    '''Every property a schema can have, across its branches.'''
    schema = _deref(schema, root)
    props = dict(schema.get('properties') or {})
    for key in ('allOf', 'anyOf', 'oneOf'):
        for branch in schema.get(key) or []:
            props.update(_properties(branch, root))
    for branch in (schema.get('dependencies') or {}).values():
        if isinstance(branch, dict):
            props.update(_properties(branch, root))
    return props


def schema_shape(schema, root, depth=0):
    '''The shape of values a JSON Schema describes.'''
    schema = _deref(schema, root)
    if depth > 8 or not schema:
        return UNKNOWN
    kind = schema.get('type')
    if isinstance(kind, list):
        kind = next((k for k in kind if k != 'null'), None)
    if kind == 'array':
        return Shape('list', item=schema_shape(schema.get('items') or {}, root, depth + 1))
    properties = _properties(schema, root)
    if kind == 'object' or properties:
        return Shape('object', fields={k: schema_shape(v, root, depth + 1)
                                       for k, v in properties.items()})
    return SCALAR


def _object(fields=None, special=None, fallback=None, sure=False):
    return Shape('object', fields=fields or {}, special=special or {}, fallback=fallback,
                 sure=sure)


def confirmation_shapes(registration_schema, camper_schema):
    '''The variables a Mustache confirmation email saw, and their Jinja paths.'''
    registration_root = registration_schema or {}
    camper_root = {
        **(camper_schema or {}),
        'definitions': {**(registration_root.get('definitions') or {}),
                        **((camper_schema or {}).get('definitions') or {})},
    }
    camper_attributes = schema_shape(camper_root, camper_root)
    registration_attributes = schema_shape(registration_root, registration_root)
    registration_type = _object({'id': SCALAR, 'name': SCALAR, 'label': SCALAR})
    registration_attributes.sure = True
    registration = _object({
        'attributes': registration_attributes,
        'registration_type': registration_type,
        'server_pricing_results': Shape('object', sure=True),
        'initial_payment': Shape('object'),
    }, special={'server_pricing_results': '{}.pricing'}, sure=True)
    # Each camper was its attributes plus three more keys.
    camper = _object(
        {**camper_attributes.fields, 'pricing_result': Shape('object', sure=True),
         'lodging': SCALAR, 'lodging_full': SCALAR},
        special={
            'pricing_result': '{}.pricing',
            'lodging': "({0}.lodging.name if {0}.lodging else 'none')",
            # Mustache's path started with the root lodging (the camp itself); Jinja's
            # path leaves it out, which is the one intended difference.
            'lodging_full': "({0}.lodging.path_names | join(', ') if {0}.lodging else 'none')",
        },
        fallback='{}.attributes', sure=True)
    root = _object({
        'registration': registration,
        'campers': Shape('list', item=camper, sure=True),
        'pricing_results': Shape('object', sure=True),
        'initial_payment': Shape('object'),
    }, special={'pricing_results': 'pricing'}, sure=True)
    return root, {'campers': 'camper'}


def invitation_shapes():
    '''The variables a Mustache invitation email saw, and their Jinja paths.'''
    root = _object({name: SCALAR for name in (
        'recipient_name', 'recipient_email', 'invitation_code', 'register_link')}, special={
        'recipient_name': '(invitation.recipient_name or invitation.recipient_email)',
        'recipient_email': 'invitation.recipient_email',
        'invitation_code': 'invitation.code',
        'register_link': 'invitation.register_url',
    }, sure=True)
    return root, {}


# --- Conversion ------------------------------------------------------------------

@dataclass
class Scope:
    expr: str | None     # the Jinja expression for this scope's value (None: the root)
    shape: Shape


IDENTIFIER = re.compile(r'[A-Za-z_][A-Za-z0-9_]*')


def _join(expr, name):
    if expr is None:
        return name
    if IDENTIFIER.fullmatch(name):
        return f'{expr}.{name}'
    return f'{expr}[{name!r}]'


def _step(expr, shape, name):
    '''Go from a value to one of its fields (or list items, for a number).'''
    if expr is not None and not shape.sure:
        # It may be missing: read through an empty one, as Mustache did.
        expr = f"({expr} or {'[]' if name.isdigit() else '{}'})"
    if name.isdigit() and shape.kind in ('list', 'unknown'):
        return f'{expr}[{name}]', (shape.item or UNKNOWN)
    if name in shape.special:
        template = shape.special[name]
        return template.format(expr) if '{' in template else template, shape.field(name)
    if shape.fallback and name not in ('',):
        base = shape.fallback.format(expr)
        return _join(base, name), shape.field(name)
    return _join(expr, name), shape.field(name)


def _singular(word):
    '''A loop variable for a list: parking_passes → parking_pass, activities → activity.'''
    for plural, singular in (('ies', 'y'), ('sses', 'ss'), ('shes', 'sh'), ('ches', 'ch'),
                             ('xes', 'x'), ('s', '')):
        if word.endswith(plural) and len(word) > len(plural):
            return word[:-len(plural)] + singular
    return f'{word}_item'


def _knows(shape, name):
    return shape.kind == 'object' and (name in shape.fields or name in shape.special)


class _Converter:
    def __init__(self, root_shape, loop_names):
        self.scopes = [Scope(None, root_shape)]
        self.loop_names = loop_names
        self.used_names = set()
        self.out = []
        self.sections = []  # (key, closing text)

    def resolve(self, key):
        '''A Mustache name (dotted), as a Jinja expression and the value's shape.'''
        if key == '.':
            scope = self.scopes[-1]
            return scope.expr or '', scope.shape
        first, *rest = key.split('.')
        # Innermost scope that has the first name; unknown to all, the innermost
        # object scope (Mustache would have printed nothing either way).
        scope = next((s for s in reversed(self.scopes) if _knows(s.shape, first)), None)
        if scope is None:
            scope = next((s for s in reversed(self.scopes) if s.shape.kind == 'object'),
                         self.scopes[0])
        expr, shape = _step(scope.expr, scope.shape, first)
        for name in rest:
            expr, shape = _step(expr, shape, name)
        return expr, shape

    def loop_name(self, key, shape):
        last = key.split('.')[-1]
        name = self.loop_names.get(last) or _singular(last)
        if not IDENTIFIER.fullmatch(name):
            name = 'item'
        base, number = name, 2
        while name in self.used_names:
            name, number = f'{base}{number}', number + 1
        self.used_names.add(name)
        return name

    def convert(self, template):
        try:
            tokens = list(chevron.tokenizer.tokenize(template))
        except chevron.tokenizer.ChevronError as error:
            raise MustacheConversionError(str(error)) from error
        for tag, key in tokens:
            if tag == 'literal':
                self.out.append(key)
            elif tag in ('variable', 'no escape'):
                expr, _ = self.resolve(key)
                self.out.append('{{ ' + expr + ' }}')
            elif tag == 'section':
                self.open_section(key)
            elif tag == 'inverted section':
                expr, _ = self.resolve(key)
                self.out.append('{% if not ' + expr + ' %}')
                self.sections.append((key, '{% endif %}', False))
            elif tag == 'end':
                if not self.sections or self.sections[-1][0] != key:
                    raise MustacheConversionError(f'Unexpected end of section {key!r}')
                _, closing, pushed = self.sections.pop()
                if pushed:
                    self.scopes.pop()
                self.out.append(closing)
            elif tag == 'set delimiter':
                raise MustacheConversionError('Changed delimiters can\'t be converted')
            elif tag == 'partial':
                raise MustacheConversionError('Partials can\'t be converted')
            else:
                raise MustacheConversionError(f'Unknown Mustache tag {tag!r}')
        if self.sections:
            raise MustacheConversionError(f'Section {self.sections[-1][0]!r} is never closed')
        return ''.join(self.out)

    def open_section(self, key):
        expr, shape = self.resolve(key)
        if shape.kind == 'list':
            name = self.loop_name(key, shape)
            items = expr if shape.sure else f'({expr} or [])'
            self.out.append('{% for ' + name + ' in ' + items + ' %}')
            # The loop's own item is there; its fields are read directly.
            item = shape.item or UNKNOWN
            self.scopes.append(Scope(name, Shape(item.kind, item.item, item.fields, item.special,
                                                 item.fallback, sure=True)))
            self.sections.append((key, '{% endfor %}', True))
        else:
            # An object (or a value) is shown when truthy, and its fields are in scope.
            self.out.append('{% if ' + expr + ' %}')
            self.scopes.append(Scope(expr, shape if shape.kind == 'object' else Shape('scalar')))
            self.sections.append((key, '{% endif %}', True))


def convert(template, shapes):
    '''Convert Mustache `template` to Jinja, given (root shape, loop names).'''
    if not template:
        return template or ''
    root, loop_names = shapes
    return _Converter(root, loop_names).convert(template)

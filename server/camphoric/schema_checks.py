'''
Checks on an event's form schemas and pricing logic that JSON Schema itself
doesn't make (SPEC DR-106): a default must be one of its field's choices, and
a text or choice answer the pricing logic reads must be one every registration
has. They return problems worded for the organizer; none is fine.
'''

import json


def choices(schema):
    '''A field's choices (`enum`, or `oneOf`/`anyOf` of `const`s), or None.'''
    if not isinstance(schema, dict):
        return None
    if isinstance(schema.get('enum'), list):
        return schema['enum']
    for key in ('oneOf', 'anyOf'):
        options = schema.get(key)
        if isinstance(options, list) and options and all(
                isinstance(o, dict) and 'const' in o for o in options):
            return [o['const'] for o in options]
    return None


def default_problems(schema, path='schema'):
    '''Defaults that aren't one of their field's choices, anywhere in `schema`.'''
    found = []
    if isinstance(schema, dict):
        options = choices(schema)
        if options is not None and 'default' in schema and schema['default'] not in options:
            found.append(f'{path}: the default {json.dumps(schema["default"])} '
                         'is not one of its choices')
        item_options = choices(schema.get('items'))
        if (schema.get('type') == 'array' and item_options is not None
                and isinstance(schema.get('default'), list)):
            found += [f'{path}: the default {json.dumps(value)} is not one of its choices'
                      for value in schema['default'] if value not in item_options]
        for key, value in schema.items():
            found += default_problems(value, f'{path}.{key}')
    elif isinstance(schema, list):
        for index, value in enumerate(schema):
            found += default_problems(value, f'{path}[{index}]')
    return found


def _is_constant(node):
    '''A JsonLogic literal: no operator anywhere in it.'''
    if isinstance(node, dict):
        return False
    if isinstance(node, list):
        return all(_is_constant(item) for item in node)
    return True


def _var(node):
    '''`(name, fallback)` for a bare `{"var": …}` (fallback `_NONE` without one), else None.'''
    if not (isinstance(node, dict) and set(node) == {'var'}):
        return None
    args = node['var']
    name, rest = (args[0], args[1:]) if isinstance(args, list) and args else (args, [])
    return (name, rest[0] if rest else _NONE) if isinstance(name, str) else None


_NONE = object()  # no fallback


def _present_if_true(condition):
    '''
    Names a condition is true only when they're there: `{"var": n}` or
    `{"!!": …}` of it, without a fallback (which would make it true when
    they're missing).
    '''
    if isinstance(condition, dict) and set(condition) == {'!!'}:
        arg = condition['!!']
        condition = arg[0] if isinstance(arg, list) and len(arg) == 1 else arg
    var = _var(condition)
    return {var[0]} if var and var[1] is _NONE else set()


def _missing_if_true(condition):
    '''Names a `{"missing": […]}` condition is true for when they're absent.'''
    if isinstance(condition, dict) and set(condition) == {'missing'}:
        names = condition['missing']
        return {n for n in (names if isinstance(names, list) else [names]) if isinstance(n, str)}
    return set()


def _reads(node, out, guards=frozenset()):
    '''
    Every `var` a JsonLogic tree reads: `(name, fallback, guarded)`. The
    fallback is the var's own default, or the constant after it in an `or`
    (`_NONE` without either); it's guarded inside the branch of an `if` that
    runs only when the answer is there.
    '''
    if isinstance(node, list):
        for item in node:
            _reads(item, out, guards)
        return
    if not isinstance(node, dict):
        return
    for op, args in node.items():
        if op == 'var':
            var = _var(node)
            if var:
                name, fallback = var
                guarded = any(name == g or name.startswith(g + '.') for g in guards)
                out.append((name, fallback, guarded))
        elif op == 'or' and isinstance(args, list):
            for index, arg in enumerate(args):
                var = _var(arg)
                constant = next((a for a in args[index + 1:] if _is_constant(a)), _NONE)
                if var and var[1] is _NONE and constant is not _NONE:
                    _reads({'var': [var[0], constant]}, out, guards)
                else:
                    _reads(arg, out, guards)
        elif op == 'if' and isinstance(args, list):
            # if [c1, t1, c2, t2, …, else]: tN runs when cN is true; what
            # follows a condition runs when it's false.
            later = set(guards)
            for index in range(0, len(args) - 1, 2):
                condition, then = args[index], args[index + 1]
                present = _present_if_true(condition)
                if not present:  # testing for an answer isn't using it
                    _reads(condition, out, frozenset(later))
                _reads(then, out, frozenset(later | present))
                later |= _missing_if_true(condition)
            if len(args) % 2:
                _reads(args[-1], out, frozenset(later))
        else:
            _reads(args, out, guards)


def _resolve(field_schema, *schemas):
    '''A field's schema, following a local `#/definitions/…` `$ref`.'''
    ref = field_schema.get('$ref')
    if isinstance(ref, str) and ref.startswith('#/definitions/'):
        for schema in schemas:
            target = (schema.get('definitions') or {}).get(ref[len('#/definitions/'):])
            if isinstance(target, dict):
                return {**target, **{k: v for k, v in field_schema.items() if k != '$ref'}}
    return field_schema


def pricing_input_problems(registration_schema, camper_schema, registration_logic, camper_logic):
    '''
    Text and choice answers the pricing logic reads that a registration may
    lack: neither required (at the top of their schema), nor given a fallback
    in the logic (a var default, or a constant after it in an `or`), nor read
    only where an `if` has found them there; or given a fallback that isn't
    one of their choices. A missing one prices as no match — often $0 (#771).
    Numbers, lists, objects and checkboxes are left alone: missing means none.
    "Required" is taken at its word, though it holds only for registrations
    saved after it was (DR-106). Returns `{logic field: [problem]}`.
    '''
    schemas = {'registration': registration_schema or {}, 'camper': camper_schema or {}}
    found = {}
    for logic_field, logic in (('registration_pricing_logic', registration_logic),
                               ('camper_pricing_logic', camper_logic)):
        reads = []
        _reads(logic or [], reads)
        problems = []
        for name, fallback, guarded in reads:
            parts = name.split('.')
            schema = schemas.get(parts[0])
            properties = (schema or {}).get('properties') or {}
            if schema is None or len(parts) < 2 or parts[1] == 'lodging' \
                    or not isinstance(properties.get(parts[1]), dict):
                continue
            field = parts[1]
            field_schema = _resolve(properties[field], schema, schemas['registration'])
            options = choices(field_schema)
            kind = field_schema.get('type')
            text = kind == 'string' or (isinstance(kind, list) and 'string' in kind) \
                or (kind is None and options is not None)
            if not text:
                continue
            if fallback is not _NONE:
                if options is not None and len(parts) == 2 and fallback not in options:
                    problems.append(
                        f'{name}: its fallback {json.dumps(fallback)} is not one of its '
                        f'choices, so a {parts[0]} without one matches nothing.')
            elif not guarded and field not in (schema.get('required') or []):
                problems.append(
                    f'{name}: the pricing reads it, but the {parts[0]} schema doesn\'t '
                    f'require it and the logic gives it no fallback. Give the var one, e.g. '
                    f'{{"var": ["{name}", <value>]}}, or make it required (which covers new '
                    f'registrations; any saved without it still need it added).')
        if problems:
            found[logic_field] = sorted(set(problems))
    return found


def new_problems(after, before):
    '''
    The problems in `after` that `before` didn't have, `{field: [problem]}`:
    a save is refused only for what it brings in (DR-106).
    '''
    found = {}
    for field, problems in after.items():
        fresh = [p for p in problems if p not in before.get(field, [])]
        if fresh:
            found[field] = fresh
    return found


# The event fields whose schemas the server checks when they're saved.
FORM_SCHEMA_FIELDS = ('registration_schema', 'camper_schema', 'payment_schema')


def event_problems(event):
    '''
    Everything these checks find in an event (a dict of its fields), as saving
    it would report them: `{field: [problem]}`.
    '''
    found = {}
    for field in FORM_SCHEMA_FIELDS:
        problems = default_problems(event.get(field) or {}, field)
        if problems:
            found[field] = problems
    for field, problems in pricing_input_problems(
            event.get('registration_schema'), event.get('camper_schema'),
            event.get('registration_pricing_logic'), event.get('camper_pricing_logic')).items():
        found.setdefault(field, []).extend(problems)
    return found


if __name__ == '__main__':
    # `python3 schema_checks.py < event.json`: the data/ import validation runs
    # the server's own checks on each event without a server (DR-106).
    import sys
    print(json.dumps(event_problems(json.load(sys.stdin))))

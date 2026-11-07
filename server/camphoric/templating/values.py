'''
The value types templates see.

Every object Camphoric hands to a template is plain data — dicts, lists,
strings, numbers, `Decimal`s and dates — never a Django model, so methods like
`.save()` or `.delete()` can't be reached. Objects are *read-only*: the sandbox
(`env.py`) refuses the mutating methods of anything that is `ReadOnly`, so one
render can't change what the next one sees (bulk email renders many
recipients from one graph). Templates build their own lists and dicts for
computed values.
'''

from dataclasses import dataclass, field
import datetime
from decimal import Decimal
from types import MappingProxyType

# Methods a template may not call on Camphoric's objects.
MUTATING_METHODS = frozenset({
    'update', 'setdefault', 'pop', 'popitem', 'clear', '__setitem__', '__delitem__',
    'append', 'extend', 'insert', 'remove', 'sort', 'reverse',
})


class ReadOnly:
    '''Marker for values templates may read but not change.'''


class ReadOnlyDict(ReadOnly, dict):
    '''Free-form JSON (form answers, pricing results, …).'''


class ReadOnlyList(ReadOnly, list):
    pass


@dataclass(frozen=True)
class DictType:
    '''
    The keys an event's data dict may have (its forms' questions, its pricing
    lines), from the describe type `name` (e.g. `pricing:camper`), so a
    template that reads any other key can be warned. `fields` is None when the
    dict may hold any key. `children` are the types of its nested objects and
    of each item of its lists of objects, by key.
    '''
    name: str
    label: str            # how a warning names it: 'camper.pricing'
    fields: frozenset | None
    children: MappingProxyType = field(default_factory=lambda: MappingProxyType({}),
                                       compare=False, repr=False)

    def defines(self, key):
        return self.fields is None or key in self.fields

    def union(self, other):
        '''The keys either type allows (e.g. two registration types' forms).'''
        fields = None if self.fields is None or other.fields is None \
            else self.fields | other.fields
        children = {}
        for key in self.children.keys() | other.children.keys():
            mine, theirs = self.children.get(key), other.children.get(key)
            children[key] = mine.union(theirs) if mine and theirs else mine or theirs
        return DictType(name=self.name, label=self.label, fields=fields,
                        children=MappingProxyType(children))


class DescribedDict(ReadOnlyDict):
    '''
    An event's data dict, with the `DictType` its keys are checked against.
    The type is kept under an underscore name, which the sandbox won't let a
    template read, so it can't hide an answer of the same name (`x.dict_type`
    reads the key, as on any dict).
    '''

    def __init__(self, items, dict_type):
        super().__init__(items)
        self._dict_type = dict_type


def freeze_described(value, dict_type):
    '''
    `freeze`, tagging dicts (and the dicts in lists) with `dict_type`, and
    their nested dicts with its children's types. No type: plain `freeze`.
    '''
    if dict_type is None or isinstance(value, ReadOnly):
        return freeze(value)
    if isinstance(value, dict):
        return DescribedDict(
            ((key, freeze_described(item, dict_type.children.get(key)))
             for key, item in value.items()),
            dict_type)
    if isinstance(value, (list, tuple)):
        return ReadOnlyList(freeze_described(item, dict_type) for item in value)
    return value


class TemplateObject(ReadOnly, dict):
    '''
    A typed object in the graph (a camper, a registration, …). Fields are dict
    keys, so `camper.attributes`, `camper['attributes']`,
    `sort(attribute='registration.created_at')` and `selectattr` all work.

    The graph is cyclic (a camper's registration lists the camper), so the
    string form is shallow: `<camper 12>`.
    '''
    type_name = 'object'

    def __repr__(self):
        return f'<{self.type_name} {self.get("id")}>'

    __str__ = __repr__

    def __hash__(self):
        # Needed for `unique`, `groupby` and set membership; identity is the id.
        return hash((self.type_name, self.get('id')))

    def __eq__(self, other):
        if isinstance(other, TemplateObject):
            return self.type_name == other.type_name and self.get('id') == other.get('id')
        return NotImplemented


def _make_type(name):
    return type(f'{name.title().replace("_", "")}Var', (TemplateObject,), {'type_name': name})


EventVar = _make_type('event')
RegistrationVar = _make_type('registration')
RegistrationTypeVar = _make_type('registration_type')
CamperVar = _make_type('camper')
LodgingVar = _make_type('lodging')
PaymentVar = _make_type('payment')
InvoiceVar = _make_type('invoice')
CustomChargeVar = _make_type('custom_charge')
CustomChargeTypeVar = _make_type('custom_charge_type')
InvitationVar = _make_type('invitation')
RecipientVar = _make_type('recipient')


def freeze(value):
    '''Recursively turn JSON data into read-only dicts and lists.'''
    if isinstance(value, ReadOnly):
        return value
    if isinstance(value, dict):
        return ReadOnlyDict((key, freeze(item)) for key, item in value.items())
    if isinstance(value, (list, tuple)):
        return ReadOnlyList(freeze(item) for item in value)
    return value


def to_plain(value, depth=2, _level=0):
    '''
    A JSON-friendly copy of a value, `depth` levels of Camphoric objects deep;
    deeper objects become references like `{"$ref": "camper:12"}`. Used by the
    `dump`, `tojson` and `pprint` filters, which would otherwise walk the cyclic
    graph forever.
    '''
    if isinstance(value, TemplateObject):
        if _level >= depth:
            return {'$ref': f'{value.type_name}:{value.get("id")}'}
        return {key: to_plain(item, depth, _level + 1) for key, item in value.items()}
    if isinstance(value, dict):
        return {str(key): to_plain(item, depth, _level) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [to_plain(item, depth, _level) for item in value]
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    return value

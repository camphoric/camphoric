'''
The description of everything a template can use (SPEC §9.3, DR-37): the
object types and their fields, the variables each kind of template receives,
and the filters, tests and tags. It is served by the describe endpoint and
drives editor autocomplete, hover docs and both help surfaces, so every entry
carries a short doc and, where useful, an example.

Tests keep this in step with the code: each type's fields must equal the keys
`graph.py` builds, each context's roots the keys `contexts.py` builds, and
every filter in the environment must be described here.

Type strings: `string`, `number`, `bool`, `money` (a two-place Decimal),
`date`, `datetime`, `dict`, `list<T>`, a type name (`camper`), or an
event-specific type (`attributes:camper`, `pricing:registration`, …) that
`describe.py` fills in from the event's own forms and pricing.
'''

from dataclasses import asdict, dataclass

from . import values


@dataclass(frozen=True)
class FieldSpec:
    name: str
    type: str
    doc: str
    example: str | None = None
    nullable: bool = False
    # Methods (date.strftime …): inserted with parentheses by the editor.
    callable: bool = False
    signature: str | None = None

    def as_dict(self):
        return {key: value for key, value in asdict(self).items() if value not in (None, False)}


@dataclass(frozen=True)
class TypeSpec:
    name: str
    doc: str
    fields: tuple
    var_class: type | None = None  # the graph class, for the drift test

    def as_dict(self):
        return {'doc': self.doc, 'fields': [f.as_dict() for f in self.fields]}


@dataclass(frozen=True)
class ContextSpec:
    name: str
    title: str
    doc: str
    roots: tuple
    sample: str | None = None  # the kind of record a preview renders for

    def as_dict(self):
        return {
            'title': self.title,
            'doc': self.doc,
            'roots': [r.as_dict() for r in self.roots],
            'sample': self.sample,
        }


@dataclass(frozen=True)
class FilterSpec:
    name: str
    signature: str
    doc: str
    example: str
    builtin: bool = False

    def as_dict(self):
        return asdict(self)


@dataclass(frozen=True)
class TestSpec:
    name: str
    doc: str
    example: str

    def as_dict(self):
        return asdict(self)


@dataclass(frozen=True)
class TagSpec:
    name: str
    doc: str
    snippet: str  # Monaco snippet syntax

    def as_dict(self):
        return asdict(self)


F = FieldSpec

ID = F('id', 'number', 'Database id.')

TYPES = (
    TypeSpec('event', 'The event (camp) the template belongs to.', (
        ID,
        F('name', 'string', "The event's name.", '{{ event.name }}'),
        F('organization_name', 'string', 'The organization running the event.'),
        F('start', 'date', 'First day of the event.', "{{ event.start | date('%B %-d') }}",
          nullable=True),
        F('end', 'date', 'Last day of the event.', nullable=True),
        F('registration_start', 'date', 'When registration opens.', nullable=True),
        F('registration_end', 'date', 'When registration closes.', nullable=True),
        F('days', 'list<date>', 'Every date from start to end, inclusive.',
          "{% for day in event.days %}{{ day | date('%a') }},{% endfor %}"),
        F('nights', 'list<date>', 'Every night of camp: start up to (not including) end — the '
          'dates a stay can include.',
          "{% for night in event.nights %}{{ 'X' if night in camper.stay }},{% endfor %}"),
        F('default_stay_length', 'number', 'Days a camper stays by default.'),
        F('is_open', 'bool', 'Whether registration is open today.'),
        F('pricing', 'pricing:event', "The event's pricing variables.",
          '{{ event.pricing.adult_rate | money }}'),
        F('template_vars', 'dict', "The event's registration template variables."),
        F('register_url', 'string', 'Link to the registration page.'),
        F('confirmation_email_from', 'string', 'Address confirmation emails are sent from.'),
        F('registration_types', 'list<registration_type>', 'Registration types (for invitations).'),
        F('custom_charge_types', 'list<custom_charge_type>', 'Kinds of custom charge.'),
        F('lodging', 'lodging', 'The root of the lodging tree (the camp itself).', nullable=True),
        F('lodgings', 'list<lodging>', 'Every lodging node, parents before children.'),
    ), values.EventVar),

    TypeSpec('registration', 'One registration: the registrant and their campers.', (
        ID,
        F('uuid', 'string', "The registration's unique code."),
        F('created_at', 'datetime', 'When the registration was started.',
          "{{ registration.created_at | datetime('%b %-d, %Y') }}"),
        F('updated_at', 'datetime', 'When it was last changed.'),
        F('completed', 'bool', 'Whether the registrant finished registering.'),
        F('registrant_email', 'string', "The registrant's email address."),
        F('payment_type', 'string', 'How they chose to pay (Check, PayPal, Card …).',
          nullable=True),
        F('attributes', 'attributes:registration', 'Answers to the registration form.',
          '{{ registration.attributes.comments }}'),
        F('admin_attributes', 'admin_attributes:registration', 'Admin-only fields.'),
        F('registration_type', 'registration_type', 'The registration type, for invitations.',
          nullable=True),
        F('campers', 'list<camper>', 'The campers on this registration, in form order.',
          '{% for camper in registration.campers %}…{% endfor %}'),
        F('payments', 'list<payment>', 'Payments received, oldest first.'),
        F('invitation', 'invitation', 'The invitation used to register, if any.', nullable=True),
        F('pricing', 'pricing:registration', 'Pricing results (totals by component).',
          '{{ registration.pricing.total | money }}'),
        F('total_owed', 'money', 'Total charged.', '{{ registration.total_owed | money }}'),
        F('total_paid', 'money', 'Total of the payments received.'),
        F('balance', 'money', 'Still owed: total_owed − total_paid.',
          "{% if registration.balance > 0 %}Owes {{ registration.balance | money }}{% endif %}"),
        F('initial_payment', 'dict', 'The payment choice made when registering.', nullable=True),
        F('camper_count', 'number', 'Number of campers.'),
    ), values.RegistrationVar),

    TypeSpec('camper', 'One camper.', (
        ID,
        F('index', 'number', 'Position on the registration: 0 for the first camper.'),
        F('registration', 'registration', 'The registration this camper is on.',
          '{{ camper.registration.registrant_email }}'),
        F('attributes', 'attributes:camper', "Answers to the camper form.",
          '{{ camper.attributes.first_name }}'),
        F('admin_attributes', 'admin_attributes:camper', 'Admin-only fields.'),
        F('lodging', 'lodging', 'Assigned lodging.', '{{ camper.lodging.full_name }}',
          nullable=True),
        F('lodging_requested', 'lodging', 'Lodging the registrant asked for.', nullable=True),
        F('lodging_reserved', 'bool', 'Whether the assignment uses a reserved spot.'),
        F('lodging_shared', 'bool', 'Whether they are sharing lodging.'),
        F('lodging_shared_with', 'string', 'Who they are sharing with.'),
        F('lodging_comments', 'string', 'Comments about lodging.'),
        F('stay', 'list<date>', 'The nights the camper is staying.',
          "{{ 'yes' if event.nights[0] in camper.stay }}"),
        F('first_day', 'date', 'First night of their stay.', nullable=True),
        F('last_day', 'date', 'Last night of their stay.', nullable=True),
        F('pricing', 'pricing:camper', "This camper's pricing results.",
          '{{ camper.pricing.tuition | money }}'),
        F('custom_charges', 'list<custom_charge>', 'Custom charges added by admins.'),
        F('created_at', 'datetime', 'When the camper was added.'),
    ), values.CamperVar),

    TypeSpec('lodging', 'A node in the lodging tree (the camp, an area, a cabin …).', (
        ID,
        F('name', 'string', "The node's name.", '{{ camper.lodging.name }}'),
        F('notes', 'string', 'Admin notes.'),
        F('children_title', 'string', "Label for choosing among this node's children."),
        F('visible', 'bool', 'Whether registrants can choose it.'),
        F('capacity', 'number', 'Capacity (the sum of its children when not set).'),
        F('reserved', 'number', 'Reserved spots.'),
        F('sharing_multiplier', 'number', 'How much each camper counts toward capacity.'),
        F('remaining_capacity', 'number', 'Unreserved spots left, counting every registration '
          '(as on the registration form).', nullable=True),
        F('parent', 'lodging', 'The node above this one.', nullable=True),
        F('children', 'list<lodging>', 'The nodes directly below this one.'),
        F('ancestors', 'list<lodging>', 'Nodes from the root down to the parent.'),
        F('path', 'list<lodging>', 'Nodes below the root down to this one.'),
        F('path_names', 'list<string>', 'Names along the path.', "{{ lodging.path_names[0] }}"),
        F('full_name', 'string', 'The path joined with →, e.g. "Cabins→Cabin 4".',
          '{{ camper.lodging.full_name }}'),
        F('depth', 'number', 'Levels below the root (the root is 0).'),
        F('is_leaf', 'bool', 'True for nodes with no children (where campers stay).'),
        F('is_root', 'bool', 'True for the root (the camp).'),
        F('campers', 'list<camper>', 'Campers assigned directly to this node.'),
        F('all_campers', 'list<camper>', 'Campers assigned here or anywhere below.'),
        F('camper_count', 'number', 'Number of campers here or below.'),
    ), values.LodgingVar),

    TypeSpec('payment', 'A payment received for a registration.', (
        ID,
        F('amount', 'money', 'Amount paid.', '{{ payment.amount | money }}'),
        F('paid_on', 'date', 'Date paid.', nullable=True),
        F('payment_type', 'string', 'Check, PayPal, Card, Voucher …'),
        F('notes', 'string', 'Admin notes.'),
        F('attributes', 'attributes:payment', 'Extra payment details.'),
        F('registration', 'registration', 'The registration it pays for.'),
        F('created_at', 'datetime', 'When it was recorded.'),
    ), values.PaymentVar),

    TypeSpec('registration_type', 'A kind of invitation-based registration (e.g. Staff).', (
        ID,
        F('name', 'string', 'Machine name, as used in pricing logic.'),
        F('label', 'string', 'Human-readable name.'),
    ), values.RegistrationTypeVar),

    TypeSpec('custom_charge', 'A charge (or credit) an admin added to a camper.', (
        ID,
        F('type', 'custom_charge_type', 'The kind of charge.', nullable=True),
        F('name', 'string', "The charge type's machine name."),
        F('label', 'string', "The charge type's label."),
        F('amount', 'money', 'Amount.'),
        F('notes', 'string', 'Admin notes.'),
        F('camper', 'camper', 'The camper charged.'),
    ), values.CustomChargeVar),

    TypeSpec('custom_charge_type', 'A kind of custom charge.', (
        ID,
        F('name', 'string', 'Machine name.'),
        F('label', 'string', 'Label.'),
    ), values.CustomChargeTypeVar),

    TypeSpec('invitation', 'An invitation to register with a registration type.', (
        ID,
        F('recipient_name', 'string', 'Who it was sent to.'),
        F('recipient_email', 'string', 'Their email address.'),
        F('code', 'string', 'The invitation code.'),
        F('registration_type', 'registration_type', 'The registration type it grants.',
          nullable=True),
        F('registration', 'registration', 'The registration made with it, if any.',
          nullable=True),
        F('sent_time', 'datetime', 'When it was last sent.', nullable=True),
        F('expiration_time', 'datetime', 'When it expires.', nullable=True),
        F('register_url', 'string', 'Link to register with this invitation.',
          '[Register]({{ invitation.register_url }})'),
        F('redeemed', 'bool', 'Whether it has been used to register.'),
    ), values.InvitationVar),

    TypeSpec('recipient', 'Who a bulk email is going to.', (
        F('id', 'string', 'Same as the email address.'),
        F('email', 'string', 'Email address.'),
        F('name', 'string', 'Name, when known.'),
    ), values.RecipientVar),

    TypeSpec('loop', 'The current loop, available inside `{% for %}`.', (
        F('index', 'number', 'Iteration, counting from 1.'),
        F('index0', 'number', 'Iteration, counting from 0.'),
        F('first', 'bool', 'True on the first iteration.'),
        F('last', 'bool', 'True on the last iteration.'),
        F('length', 'number', 'Number of items.'),
        F('revindex', 'number', 'Iterations left, counting to 1.'),
        F('previtem', 'any', 'The previous item.', nullable=True),
        F('nextitem', 'any', 'The next item.', nullable=True),
        F('cycle', 'string', 'Cycle through values.', "{{ loop.cycle('odd', 'even') }}",
          callable=True, signature="cycle(*values)"),
    )),

    TypeSpec('date', 'A calendar date.', (
        F('year', 'number', 'Year.'),
        F('month', 'number', 'Month, 1–12.'),
        F('day', 'number', 'Day of the month.'),
        F('strftime', 'string', 'Format with strftime codes.', "{{ day.strftime('%a %b %-d') }}",
          callable=True, signature='strftime(format)'),
        F('isoformat', 'string', 'YYYY-MM-DD.', callable=True, signature='isoformat()'),
        F('weekday', 'number', 'Day of the week, Monday = 0.', callable=True,
          signature='weekday()'),
    )),

    TypeSpec('datetime', 'A date and time, in the event time zone.', (
        F('year', 'number', 'Year.'),
        F('month', 'number', 'Month, 1–12.'),
        F('day', 'number', 'Day of the month.'),
        F('hour', 'number', 'Hour, 0–23.'),
        F('minute', 'number', 'Minute.'),
        F('strftime', 'string', 'Format with strftime codes.',
          "{{ registration.created_at.strftime('%b %-d %H:%M') }}",
          callable=True, signature='strftime(format)'),
        F('date', 'date', 'Just the date.', callable=True, signature='date()'),
        F('isoformat', 'string', 'ISO 8601 text.', callable=True, signature='isoformat()'),
    )),
)

TYPES_BY_NAME = {t.name: t for t in TYPES}

EVENT = F('event', 'event', 'The event.', '{{ event.name }}')

CONTEXTS = (
    ContextSpec('report', 'Reports', 'Reports see every completed registration of the event. '
                'Registrations that were started but not finished are in '
                '`incomplete_registrations`.', (
                    EVENT,
                    F('registrations', 'list<registration>', 'Completed registrations, oldest '
                      'first.', '{% for registration in registrations %}…{% endfor %}'),
                    F('incomplete_registrations', 'list<registration>', 'Registrations that '
                      'were started but not completed.'),
                    F('campers', 'list<camper>', 'Campers of completed registrations.',
                      "{% for camper in campers | sort(attribute='attributes.last_name') %}"),
                    F('payments', 'list<payment>', 'Payments on completed registrations.'),
                    F('lodging', 'lodging', 'The root of the lodging tree.', nullable=True),
                    F('lodgings', 'list<lodging>', 'Every lodging node, parents first.'),
                    F('registration_types', 'list<registration_type>', 'Registration types.'),
                    F('custom_charge_types', 'list<custom_charge_type>', 'Custom charge types.'),
                    F('invitations', 'list<invitation>', 'Invitations sent.'),
                    F('today', 'date', "Today's date (event time zone)."),
                    F('now', 'datetime', 'The current time (event time zone).'),
                )),
    ContextSpec('confirmation_email', 'Confirmation email', 'Sent to the registrant when they '
                'finish registering.', (
                    EVENT,
                    F('registration', 'registration', 'The registration just completed.',
                      nullable=True),
                    F('campers', 'list<camper>', 'Its campers.',
                      '{% for camper in campers %}- {{ camper.attributes.first_name }}\n'
                      '{% endfor %}'),
                    F('pricing', 'pricing:registration', 'Its pricing results.',
                      '{{ pricing.total | money }}', nullable=True),
                    F('initial_payment', 'dict', 'The payment choice made when registering.',
                      nullable=True),
                ), sample='registration'),
    ContextSpec('invitation_email', 'Invitation email', 'Sent when an admin invites someone to '
                'register with a registration type.', (
                    EVENT,
                    F('invitation', 'invitation', 'The invitation being sent.',
                      '[Register here]({{ invitation.register_url }})', nullable=True),
                    F('registration_type', 'registration_type', 'The type it grants.',
                      nullable=True),
                ), sample='invitation'),
    ContextSpec('bulk_email_registration', 'Bulk email (per registration)', 'Sent to each '
                'chosen registration.', (
                    EVENT,
                    F('registration', 'registration', 'The recipient registration.',
                      nullable=True),
                    F('campers', 'list<camper>', 'Its campers.'),
                    F('recipient', 'recipient', 'Who this copy is going to.'),
                ), sample='registration'),
    ContextSpec('bulk_email_camper', 'Bulk email (per camper)', 'Sent to each chosen camper.', (
        EVENT,
        F('camper', 'camper', 'The recipient camper.', nullable=True),
        F('registration', 'registration', "The camper's registration.", nullable=True),
        F('recipient', 'recipient', 'Who this copy is going to.'),
    ), sample='camper'),
    ContextSpec('bulk_email_manual', 'Bulk email (listed addresses)', 'Sent to addresses listed '
                'by hand.', (
                    EVENT,
                    F('recipient', 'recipient', 'Who this copy is going to.'),
                )),
)

CONTEXTS_BY_NAME = {c.name: c for c in CONTEXTS}

FILTERS = (
    FilterSpec('money', "money(symbol='$', places=2, commas=True)",
               'Format an amount as money. Blank stays blank.',
               '{{ registration.balance | money }} → $1,234.50'),
    FilterSpec('date', "date(format='%Y-%m-%d')",
               'Format a date (or a datetime or "YYYY-MM-DD" text) with strftime codes: '
               '%a Tue, %A Tuesday, %b Dec, %B December, %-d 30, %Y 2026.',
               "{{ event.start | date('%A %B %-d') }} → Wednesday December 30"),
    FilterSpec('datetime', "datetime(format='%Y-%m-%d %H:%M', tz=None)",
               'Format a date and time, in the event time zone unless `tz` is given.',
               "{{ registration.created_at | datetime('%b %-d %-I:%M%p') }}"),
    FilterSpec('to_date', 'to_date', 'Turn "YYYY-MM-DD" text (e.g. a form answer) into a date '
               'you can compare.', '{% if camper.attributes.arrival | to_date > event.start %}'),
    FilterSpec('csv', 'csv', 'Quote a value for a CSV cell when it needs it (commas, quotes, '
               'line breaks).', '{{ camper.attributes.last_name | csv }}'),
    FilterSpec('csv_row', 'csv_row', 'A CSV line from a list of values.',
               '{{ [camper.attributes.first_name, camper.lodging.full_name] | csv_row }}'),
    FilterSpec('md_cell', 'md_cell', 'Escape text for a Markdown table cell.',
               '| {{ camper.attributes.comments | md_cell }} |'),
    FilterSpec('regex_replace', 'regex_replace(pattern, replacement)',
               'Replace every match of a regular expression.',
               "{{ camper.attributes.phone | regex_replace('^\\\\+1', '') }}"),
    FilterSpec('merge', 'merge(other)', 'A new dict with the keys of both — for building your '
               'own rows.', "{% set row = {'name': name} | merge({'nights': 3}) %}"),
    FilterSpec('dump', 'dump(depth=2)', 'Show a value as JSON, to see what it contains while '
               'writing a template.', '<pre>{{ campers[0] | dump }}</pre>'),
    FilterSpec('money_fmt', 'money_fmt', 'Legacy: round to two decimal places. Prefer `money`.',
               '{{ 3.14159 | money_fmt }} → 3.14'),
    FilterSpec('tojson', 'tojson(indent=None)', 'JSON text of a value.',
               '{{ registration.attributes | tojson }}', builtin=True),
    FilterSpec('pprint', 'pprint', 'Readable form of a value, for debugging.',
               '{{ camper.pricing | pprint }}', builtin=True),
    FilterSpec('default', "default(value, boolean=False)", 'A fallback when a value is '
               'missing (or, with `true`, empty).',
               "{{ camper.attributes.nickname | default('–') }}",
               builtin=True),
    FilterSpec('join', "join(separator='', attribute=None)", 'Join a list into text.',
               "{{ camper.lodging.path_names | join(' / ') }}", builtin=True),
    FilterSpec('sort', "sort(reverse=False, case_sensitive=False, attribute=None)",
               'Sort a list; `attribute` may be a dotted path, or several separated by commas.',
               "{% for c in campers | "
               "sort(attribute='attributes.last_name,attributes.first_name') %}",
               builtin=True),
    FilterSpec('selectattr', 'selectattr(attribute, test, value)',
               'Keep items whose attribute passes a test.',
               "{{ campers | selectattr('attributes.linens') | list | length }}", builtin=True),
    FilterSpec('rejectattr', 'rejectattr(attribute, test, value)',
               'Drop items whose attribute passes a test.',
               "{{ campers | rejectattr('lodging') | list }}", builtin=True),
    FilterSpec('map', "map(attribute=…) | map('filter')", 'Pick one attribute from every item, '
               'or apply a filter to each.', "{{ campers | map(attribute='attributes.email') | "
               "join(', ') }}", builtin=True),
    FilterSpec('groupby', 'groupby(attribute)', 'Group items by an attribute; gives '
               '(grouper, list) pairs.', "{% for lodging, group in campers | "
               "groupby('lodging.full_name') %}", builtin=True),
    FilterSpec('length', 'length', 'Number of items (or characters).',
               '{{ campers | length }}', builtin=True),
    FilterSpec('count', 'count', 'Same as length.', '{{ registrations | count }}', builtin=True),
    FilterSpec('first', 'first', 'First item.', '{{ registration.campers | first }}',
               builtin=True),
    FilterSpec('last', 'last', 'Last item.', '{{ camper.stay | last }}', builtin=True),
    FilterSpec('sum', "sum(attribute=None, start=0)", 'Add up numbers, or one attribute of '
               'every item.', "{{ registrations | sum(attribute='balance') | money }}",
               builtin=True),
    FilterSpec('min', 'min(attribute=None)', 'Smallest item.',
               "{{ campers | map(attribute='first_day') | reject('none') | min }}", builtin=True),
    FilterSpec('max', 'max(attribute=None)', 'Largest item.',
               "{{ payments | max(attribute='amount') }}",
               builtin=True),
    FilterSpec('unique', 'unique(attribute=None)', 'Drop duplicates.',
               "{{ campers | map(attribute='registration.registrant_email') | unique | list }}",
               builtin=True),
    FilterSpec('list', 'list', 'Turn a sequence into a list (e.g. after selectattr).',
               "{{ campers | selectattr('lodging') | list }}", builtin=True),
    FilterSpec('batch', 'batch(size, fill_with=None)', 'Split a list into groups of `size`.',
               '{% for row in campers | batch(3) %}', builtin=True),
    FilterSpec('dictsort', 'dictsort(by="key")', 'Sort a dict into (key, value) pairs.',
               '{% for key, value in camper.attributes | dictsort %}', builtin=True),
    FilterSpec('replace', 'replace(old, new, count=None)', 'Replace text.',
               "{{ camper.attributes.phone | replace('+1', '') }}", builtin=True),
    FilterSpec('trim', 'trim', 'Remove surrounding whitespace.', '{{ text | trim }}',
               builtin=True),
    FilterSpec('lower', 'lower', 'Lower case.', '{{ name | lower }}', builtin=True),
    FilterSpec('upper', 'upper', 'Upper case.', '{{ name | upper }}', builtin=True),
    FilterSpec('title', 'title', 'Title Case.', '{{ name | title }}', builtin=True),
    FilterSpec('capitalize', 'capitalize', 'Capitalize the first letter.',
               '{{ text | capitalize }}',
               builtin=True),
    FilterSpec('truncate', 'truncate(length=255, killwords=False, end="...")',
               'Shorten long text.', '{{ camper.attributes.comments | truncate(40) }}',
               builtin=True),
    FilterSpec('round', "round(precision=0, method='common')", 'Round a number.',
               '{{ 2.567 | round(1) }} → 2.6', builtin=True),
    FilterSpec('int', 'int(default=0)', 'Convert to a whole number.', "{{ '3' | int }}",
               builtin=True),
    FilterSpec('float', 'float(default=0.0)', 'Convert to a number.', "{{ '3.5' | float }}",
               builtin=True),
    FilterSpec('abs', 'abs', 'Absolute value.', '{{ registration.balance | abs | money }}',
               builtin=True),
    FilterSpec('string', 'string', 'Convert to text.', '{{ camper.id | string }}', builtin=True),
    FilterSpec('select', 'select(test, …)', 'Keep items that pass a test.',
               "{{ numbers | select('odd') | list }}", builtin=True),
    FilterSpec('reject', 'reject(test, …)', 'Drop items that pass a test.',
               "{{ values | reject('none') | list }}", builtin=True),
    FilterSpec('reverse', 'reverse', 'Reverse a list or text.', '{{ campers | reverse | list }}',
               builtin=True),
    FilterSpec('items', 'items', "A dict's (key, value) pairs.",
               '{% for key, value in camper.attributes | items %}', builtin=True),
    FilterSpec('attr', 'attr(name)', 'Get an attribute by name.', "{{ camper | attr('id') }}",
               builtin=True),
    FilterSpec('wordcount', 'wordcount', 'Count words.', '{{ text | wordcount }}', builtin=True),
    FilterSpec('indent', 'indent(width=4, first=False)', 'Indent every line.',
               '{{ text | indent(2) }}', builtin=True),
    FilterSpec('center', 'center(width=80)', 'Center text in a width.', '{{ title | center(40) }}',
               builtin=True),
    FilterSpec('format', 'format(*args)', 'printf-style formatting.',
               "{{ '%-20s|' | format(name) }}", builtin=True),
    FilterSpec('filesizeformat', 'filesizeformat', 'A byte count as readable text.',
               '{{ 1500000 | filesizeformat }}', builtin=True),
    FilterSpec('striptags', 'striptags', 'Remove HTML tags.', '{{ html | striptags }}',
               builtin=True),
    FilterSpec('urlencode', 'urlencode', 'Encode text for a URL.', '{{ email | urlencode }}',
               builtin=True),
    FilterSpec('urlize', 'urlize', 'Turn URLs in text into links.', '{{ text | urlize }}',
               builtin=True),
    FilterSpec('xmlattr', 'xmlattr', 'HTML attributes from a dict.',
               "<td{{ {'class': 'x'} | xmlattr }}>", builtin=True),
    FilterSpec('escape', 'escape', 'Escape HTML.', '{{ text | escape }}', builtin=True),
    FilterSpec('e', 'e', 'Same as escape.', '{{ text | e }}', builtin=True),
    FilterSpec('forceescape', 'forceescape', 'Escape HTML even if already safe.',
               '{{ text | forceescape }}', builtin=True),
    FilterSpec('safe', 'safe', 'Mark text as safe HTML (HTML reports only).',
               '{{ html | safe }}', builtin=True),
    FilterSpec('d', 'd(value)', 'Same as default.', "{{ value | d('–') }}", builtin=True),
    FilterSpec('slice', 'slice(slices, fill_with=None)', 'Split a list into `slices` columns.',
               '{% for column in campers | slice(3) %}', builtin=True),
    FilterSpec('wordwrap', 'wordwrap(width=79)', 'Wrap long text at a width.',
               '{{ text | wordwrap(60) }}', builtin=True),
)

# Filters left out of the help on purpose.
HIDDEN_FILTERS = frozenset({'random'})

FILTERS_BY_NAME = {f.name: f for f in FILTERS}

TESTS = (
    TestSpec('defined', 'The value exists.', '{% if camper.attributes.email is defined %}'),
    TestSpec('undefined', 'The value is missing.', '{% if camper.lodging is undefined %}'),
    TestSpec('none', 'The value is empty (None).', '{% if camper.lodging is none %}'),
    TestSpec('number', 'The value is a number.', '{% if value is number %}'),
    TestSpec('string', 'The value is text.', '{% if value is string %}'),
    TestSpec('mapping', 'The value is a dict.', '{% if value is mapping %}'),
    TestSpec('sequence', 'The value is a list (or text).', '{% if value is sequence %}'),
    TestSpec('iterable', 'The value can be looped over.', '{% if value is iterable %}'),
    TestSpec('boolean', 'The value is true or false.', '{% if value is boolean %}'),
    TestSpec('true', 'The value is True.', '{% if camper.attributes.linens is true %}'),
    TestSpec('false', 'The value is False.', '{% if camper.lodging_shared is false %}'),
    TestSpec('integer', 'The value is a whole number.', '{% if value is integer %}'),
    TestSpec('float', 'The value is a decimal number.', '{% if value is float %}'),
    TestSpec('even', 'The number is even.', '{% if loop.index is even %}'),
    TestSpec('odd', 'The number is odd.', '{% if loop.index is odd %}'),
    TestSpec('divisibleby', 'The number divides evenly.', '{% if loop.index is divisibleby(3) %}'),
    TestSpec('in', 'The value is in a list.',
             "{% if camper.attributes.age is in ['0-2', '3-12'] %}"),
    TestSpec('eq', 'Equal (also ==).',
             "{{ campers | selectattr('attributes.age', 'eq', 'Adult') | list }}"),
    TestSpec('ne', 'Not equal (also !=).',
             "{{ registrations | selectattr('payment_type', 'ne', 'Check') | list }}"),
    TestSpec('lt', 'Less than (also <).',
             "{{ registrations | selectattr('balance', 'lt', 0) | list }}"),
    TestSpec('le', 'Less than or equal (also <=).', "selectattr('camper_count', 'le', 2)"),
    TestSpec('gt', 'Greater than (also >).',
             "{{ registrations | selectattr('balance', 'gt', 0) | list }}"),
    TestSpec('ge', 'Greater than or equal (also >=).', "selectattr('camper_count', 'ge', 2)"),
    TestSpec('sameas', 'The very same object.', '{% if a is sameas b %}'),
    TestSpec('lower', 'The text is lower case.', '{% if name is lower %}'),
    TestSpec('upper', 'The text is upper case.', '{% if name is upper %}'),
    TestSpec('callable', 'The value can be called.', '{% if value is callable %}'),
    TestSpec('escaped', 'The value is escaped HTML.', '{% if value is escaped %}'),
    TestSpec('filter', 'A filter with this name exists.', "{% if 'money' is filter %}"),
    TestSpec('test', 'A test with this name exists.', "{% if 'odd' is test %}"),
)

TAGS = (
    TagSpec('for', 'Repeat for each item. `loop` describes the current pass; add `{% else %}` '
            'for when the list is empty.', '{% for ${1:item} in ${2:items} %}\n\t$0\n{% endfor %}'),
    TagSpec('if', 'Output something only when a condition holds; `elif` / `else` add branches.',
            '{% if ${1:condition} %}\n\t$0\n{% endif %}'),
    TagSpec('set', 'Give a value a name.', '{% set ${1:name} = ${2:value} %}'),
    TagSpec('do', 'Run an expression without output — e.g. add to your own list.',
            '{% do ${1:rows}.append(${2:value}) %}'),
    TagSpec('macro', 'A reusable piece of template with parameters.',
            '{% macro ${1:name}(${2:args}) %}\n\t$0\n{% endmacro %}'),
    TagSpec('with', 'Names that only exist inside the block.',
            '{% with ${1:name} = ${2:value} %}\n\t$0\n{% endwith %}'),
    TagSpec('filter', 'Apply a filter to a whole block.',
            '{% filter ${1:upper} %}\n\t$0\n{% endfilter %}'),
    TagSpec('raw', 'Output template syntax literally.', '{% raw %}$0{% endraw %}'),
    TagSpec('break', 'Leave the current loop.', '{% break %}'),
    TagSpec('continue', 'Skip to the next pass of the loop.', '{% continue %}'),
    TagSpec('comment', 'A comment that never appears in the output.', '{# $0 #}'),
)

GLOBALS = (
    FieldSpec('range', 'list<number>', 'Numbers from start up to stop.',
              '{% for i in range(3) %}', callable=True, signature='range([start,] stop[, step])'),
    FieldSpec('namespace', 'dict', 'A container whose attributes can change inside loops — '
              'for running totals.', '{% set ns = namespace(total=0) %}'
              '{% for r in registrations %}{% set ns.total = ns.total + r.balance %}{% endfor %}',
              callable=True, signature='namespace(**values)'),
    FieldSpec('dict', 'dict', 'A new dict you can change.', "{% set row = dict(name='x') %}",
              callable=True, signature='dict(**values)'),
    FieldSpec('cycler', 'dict', 'Cycles through values with `.next()`.',
              "{% set colors = cycler('odd', 'even') %}", callable=True,
              signature='cycler(*values)'),
    FieldSpec('joiner', 'string', 'Outputs a separator every time but the first.',
              "{% set comma = joiner(', ') %}", callable=True, signature="joiner(sep=', ')"),
)

'''
Filters for Camphoric templates, beyond Jinja's built-ins (SPEC §9.3). Each is
documented in `registry.FILTERS`, which is what the editor and help pages show.
'''

import datetime
from decimal import Decimal, InvalidOperation
import json
import pprint as _pprint
import re
import unicodedata
import zoneinfo

from markupsafe import Markup

from camphoric.pricing import money_fmt as legacy_money_fmt

from .graph import parse_date, template_timezone
from .values import to_plain


def money(value, symbol='$', places=2, commas=True):
    '''1234.5 → "$1,234.50"; negative amounts → "-$12.00"; blank stays blank.'''
    if value is None or value == '':
        return ''
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return str(value)
    quantum = Decimal(1).scaleb(-int(places))
    amount = amount.quantize(quantum)
    sign = '-' if amount < 0 else ''
    digits = f'{abs(amount):,.{int(places)}f}' if commas else f'{abs(amount):.{int(places)}f}'
    return f'{sign}{symbol}{digits}'


def to_date(value):
    '''A date from a date, datetime or "YYYY-MM-DD…" string (None stays None).'''
    if value is None or value == '':
        return None
    if isinstance(value, datetime.datetime):
        return value.date()
    parsed = parse_date(value)
    return parsed if isinstance(parsed, datetime.date) else None


def format_date(value, fmt='%Y-%m-%d'):
    '''Format a date (or a datetime / ISO string) with strftime codes.'''
    day = to_date(value)
    return day.strftime(fmt) if day else ''


def format_datetime(value, fmt='%Y-%m-%d %H:%M', tz=None):
    '''Format a datetime in the event's time zone (or `tz`, e.g. "UTC").'''
    if value is None or value == '':
        return ''
    if isinstance(value, str):
        try:
            value = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return value
    if isinstance(value, datetime.datetime):
        zone = zoneinfo.ZoneInfo(tz) if tz else template_timezone()
        if value.tzinfo is not None:
            value = value.astimezone(zone)
        return value.strftime(fmt)
    if isinstance(value, datetime.date):
        return value.strftime(fmt)
    return str(value)


def regex_replace(value, pattern, replacement):
    '''Replace every match of a regular expression.'''
    return re.sub(pattern, replacement, '' if value is None else str(value))


def _text(value):
    if value is None:
        return ''
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    return str(value)


# A leading character that makes a spreadsheet read a cell as a formula (OWASP CSV Injection).
_FORMULA_START = ('=', '+', '-', '@', '\t', '\r')

# A signed plain or currency number: sign, currency symbol(s), digits with optional thousands
# commas and decimals, optional exponent — e.g. "-25", "-25.00", "+1.5e3" or the `money`
# filter's "-$25.00".
_NUMBER = re.compile(r'[+-](?P<symbol>[^\d.,]*)(?:\d[\d,]*(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?')


def _is_number(text):
    match = _NUMBER.fullmatch(text)
    return bool(match) and all(unicodedata.category(ch) == 'Sc' for ch in match['symbol'])


def csv_cell(value):
    '''
    A CSV field, quoted when needed (commas, quotes, line breaks). Text that a spreadsheet would
    run as a formula (it starts with = + - @, a tab or a carriage return) is prefixed with `'`
    first, so it opens as text; a number such as "-25" or "-$25.00" is left alone.
    '''
    text = _text(value)
    if text.startswith(_FORMULA_START) and not _is_number(text):
        text = "'" + text
    if any(ch in text for ch in ',"\r\n') or text != text.strip():
        return '"' + text.replace('"', '""') + '"'
    return text


def csv_row(values):
    '''A CSV line from a list of values, each made safe by `csv_cell`.'''
    return ','.join(csv_cell(value) for value in values)


def md_cell(value):
    '''Text that is safe inside a Markdown table cell (| and line breaks escaped).'''
    return _text(value).replace('|', '\\|').replace('\r\n', ' ').replace('\n', ' ')


def dump(value, depth=2):
    '''Pretty JSON of a value, `depth` levels of Camphoric objects deep.'''
    return json.dumps(to_plain(value, depth), indent=2, sort_keys=True, ensure_ascii=False)


def tojson(value, indent=None):
    '''JSON of a value (Camphoric objects two levels deep), safe inside HTML.'''
    text = json.dumps(to_plain(value, 2), indent=indent, sort_keys=True, ensure_ascii=False)
    return Markup(
        text.replace('<', '\\u003c').replace('>', '\\u003e')
        .replace('&', '\\u0026').replace("'", '\\u0027')
    )


def pprint(value):
    '''Readable form of a value (Camphoric objects two levels deep).'''
    return _pprint.pformat(to_plain(value, 2))


def merge(base, extra):
    '''A new dict: `base` with `extra`'s keys added — for computed rows.'''
    return {**dict(base or {}), **dict(extra or {})}


FILTERS = {
    'money': money,
    'money_fmt': legacy_money_fmt,
    'date': format_date,
    'datetime': format_datetime,
    'to_date': to_date,
    'regex_replace': regex_replace,
    'csv': csv_cell,
    'csv_row': csv_row,
    'md_cell': md_cell,
    'dump': dump,
    'tojson': tojson,
    'pprint': pprint,
    'merge': merge,
}

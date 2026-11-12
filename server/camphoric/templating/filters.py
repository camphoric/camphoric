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

# A signed number a spreadsheet reads as one: sign, currency signs, digits with optional
# thousands commas and decimals, optional exponent, then optionally a % or currency signs (after
# one space at most) — e.g. "-25", "-25.00", "+1.5e3", "-10%", "-25 €" or the `money` filter's
# "-$25.00". Only currency signs (Unicode Sc) count as a symbol: with letters a spreadsheet
# doesn't read a number anyway, and some are cell references ("-US$25" is cell US25).
_NUMBER = re.compile(
    r'[+-](?P<symbol>[^\d.,]*)(?:\d[\d,]*(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?'
    r'(?: ?(?P<suffix>[^\d\s.,]+))?'
)


def _is_currency(chars):
    return all(unicodedata.category(ch) == 'Sc' for ch in chars)


def _is_number(text):
    match = _NUMBER.fullmatch(text)
    if not match or not _is_currency(match['symbol']):
        return False
    suffix = match['suffix'] or ''
    return suffix == '%' or _is_currency(suffix)


def _runs_as_formula(text):
    # A byte-order mark is dropped by the spreadsheet when the file starts with it, so look past it.
    text = text.lstrip('﻿')
    return text.startswith(_FORMULA_START) and not _is_number(text)


def csv_cell(value):
    '''
    A CSV field, quoted when needed (commas, quotes, line breaks). Text that a spreadsheet would
    run as a formula (it starts with = + - @, a tab or a carriage return) is prefixed with `'`
    first, so it opens as text; a number such as "-25" or "-$25.00" is left alone.
    '''
    text = _text(value)
    if _runs_as_formula(text):
        text = "'" + text
    if any(ch in text for ch in ',"\r\n') or text != text.strip():
        return '"' + text.replace('"', '""') + '"'
    return text


def csv_row(values):
    '''A CSV line from a list of values, each made safe by `csv_cell`.'''
    return ','.join(csv_cell(value) for value in values)


_FIELD_END = re.compile(r'[,\r\n]')


def guard_csv_formulas(text):
    '''
    Rendered CSV with a `'` put before every cell a spreadsheet would run as a formula — what
    `csv_cell` does, applied to a whole CSV report, so a value the template wrote without `csv`
    (`{{ name }}`, or `"{{ name }}"` in its own quotes) is safe too. Only those cells change;
    every other character is kept. A cell already made safe (it starts with `'`) is left alone.
    '''
    inserts = []  # where a `'` goes
    start = 0  # where the current field begins
    size = len(text)
    while True:
        if text.startswith('"', start):
            # A quoted field: up to the closing quote ("" is a quote inside it), then whatever
            # follows before the next comma or line break, which a spreadsheet appends.
            close = start + 1
            while True:
                close = text.find('"', close)
                if close < 0 or not text.startswith('"', close + 1):
                    break
                close += 2
            if close < 0:
                close = size
            found = _FIELD_END.search(text, min(close + 1, size))
            end = found.start() if found else size
            value = text[start + 1:close].replace('""', '"') + text[close + 1:end]
            value_at = start + 1
        else:
            found = _FIELD_END.search(text, start)
            end = found.start() if found else size
            value = text[start:end]
            value_at = start
        if _runs_as_formula(value):
            inserts.append(value_at)
        if end >= size:
            break
        start = end + (2 if text.startswith('\r\n', end) else 1)
    if not inserts:
        return text
    pieces = []
    last = 0
    for at in inserts:
        pieces.append(text[last:at])
        pieces.append("'")
        last = at
    pieces.append(text[last:])
    return ''.join(pieces)


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

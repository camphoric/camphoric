'''
An event's money in totals (SPEC §8.11, §9.7; DR-173): the Totals view of the
Payments area. Everything is summed over the event's live registrations, from
the same ledger the registration screen shows (`invoices.ledgers`), so the
totals and each registration's own figures never disagree.

- `summary`: what's priced, the handling fees charged on invoices, what that
  comes to (owed), what's been received (payments less refunds), and the
  balance — split into what's still owed, what's owed back (refunds due), and
  what no invoice asks for yet.
- `charges`: the price, line by line. Each line of the event's pricing logic
  that its `total` adds up is summed over every registration (a camper line
  over every camper), with the sign the total adds it with — a campership the
  total subtracts is a credit — then the promo codes' discounts and the
  registrations' own charges (DR-170). A line the total doesn't add as it is
  (a count or rate it multiplies, a cap it takes the `min` of) or never reads
  (an age) isn't listed. Whatever the lines don't account for (those, the
  total floored at 0, an amount the total reads from elsewhere) is `other`,
  so the lines always add up to the priced total.
- `charge_types`: the custom charges by type, the campers' and the
  registrations' own apart; cancellation fees are among the registrations'
  own, and `cancellation_fees` counts them on their own.
- `payment_types`: the payments by type: received, refunded and net.
- `online_fees`: the handling fees charged on invoices beside what PayPal kept
  as its own fees on the payments it took (`pricing.paypal_fee`), so a camp
  can see whether the one covers the other.

Amounts are decimal strings.
'''

from decimal import Decimal

from camphoric import invoices, models, pricing

ZERO = Decimal('0.00')


def _amount(value):
    return f'{invoices.money(value):.2f}'


def _var_name(argument):
    '''The var a JsonLogic {"var": …} reads: "x", or ["x", default].'''
    if isinstance(argument, list):
        argument = argument[0] if argument else None
    return argument if isinstance(argument, str) else None


def _constant(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def total_signs(exp, sign=1, signs=None):
    '''
    {var: 1 or -1} for each var a `total` expression adds up as it is, with the
    sign it adds it with: `{"+": [a, {"*": [b, -1]}]}` is {a: 1, b: -1}, and
    `{"-": [a, b]}` is {a: 1, b: -1}. An `if`'s branches count, not its
    condition; a var first met with one sign keeps it. A var the total doesn't
    add as it is — multiplied by another var or by any number but 1 or -1, a
    divisor or dividend, capped by `min` or `max` — isn't a line of it: what it
    comes to is left to `other`.
    '''
    signs = {} if signs is None else signs
    if isinstance(exp, list):
        for item in exp:
            total_signs(item, sign, signs)
        return signs
    if not isinstance(exp, dict) or len(exp) != 1:
        return signs
    (operator, arguments), = exp.items()
    if operator == 'var':
        name = _var_name(arguments)
        if name:
            signs.setdefault(name, sign)
        return signs
    arguments = arguments if isinstance(arguments, list) else [arguments]
    if operator == '+':
        total_signs(arguments, sign, signs)
    elif operator == '-':
        if len(arguments) == 1:
            total_signs(arguments[0], -sign, signs)
        elif arguments:
            total_signs(arguments[0], sign, signs)
            total_signs(arguments[1:], -sign, signs)
    elif operator == '*':
        # Only an amount times 1 or -1 is still the amount, or its credit.
        constants = [a for a in arguments if _constant(a)]
        others = [a for a in arguments if not _constant(a)]
        if len(others) == 1 and all(abs(c) == 1 for c in constants):
            flips = sum(1 for c in constants if c < 0)
            total_signs(others[0], -sign if flips % 2 else sign, signs)
    elif operator in ('if', '?:'):
        # [condition, then, condition, then, …, else]: the thens and the else.
        branches = [a for index, a in enumerate(arguments)
                    if index % 2 == 1 or index == len(arguments) - 1]
        total_signs(branches, sign, signs)
    return signs


def _total_lines(logic, skip=()):
    '''
    [(var, label, sign)] for the lines of `logic` its own `total` adds up, in
    its order: each var once, and none in `skip`.
    '''
    logic = [component for component in logic or [] if isinstance(component, dict)]
    total = next((c for c in logic if c.get('var') == 'total'), None)
    if total is None:
        return []
    signs = total_signs(total.get('exp'))
    lines, seen = [], set(skip)
    for component in logic:
        var = component.get('var')
        if var != 'total' and var in signs and var not in seen:
            seen.add(var)
            lines.append((var, component.get('label') or var, signs[var]))
    return lines


def _is_number(value):
    return isinstance(value, (int, float, Decimal)) and not isinstance(value, bool)


def _charges(event, registrations):
    built_in = (pricing.PROMO, pricing.REGISTRATION_CHARGES)
    camper_lines = _total_lines(event.camper_pricing_logic, skip=built_in)
    camper_vars = {component.get('var') for component in event.camper_pricing_logic or []
                   if isinstance(component, dict)}
    # A registration line of a camper line's name has every camper's value
    # summed into it (calculate_price), so its own amount can't be told apart:
    # it isn't listed, and comes in `other`.
    registration_lines = _total_lines(
        event.registration_pricing_logic, skip=(*built_in, *camper_vars))
    lines = [
        *(('registration', var, label, sign) for var, label, sign in registration_lines),
        *(('camper', var, label, sign) for var, label, sign in camper_lines),
        ('built_in', pricing.PROMO, pricing.PROMO_LABEL, 1),
        ('built_in', pricing.REGISTRATION_CHARGES, pricing.REGISTRATION_CHARGES_LABEL, 1),
    ]
    sums = [ZERO] * len(lines)
    seen = [False] * len(lines)
    total = ZERO
    for registration in registrations:
        results = registration.server_pricing_results or {}
        campers = [c for c in results.get('campers') or [] if isinstance(c, dict)]
        for index, (level, var, _label, sign) in enumerate(lines):
            # A camper line from each camper's own results: the registration's
            # sum of it counts a line the logic lists twice twice.
            values = [c.get(var) for c in campers] if level == 'camper' else [results.get(var)]
            for value in values:
                if _is_number(value):
                    sums[index] += sign * invoices.money(value)
                    seen[index] = True
        total += invoices.money(results.get('total'))
    shown = [
        {'var': var, 'label': label, 'level': level, 'credit': sign < 0,
         'amount': _amount(sums[index])}
        for index, (level, var, label, sign) in enumerate(lines)
        # A built-in line shows only when some registration has it.
        if level != 'built_in' or seen[index]
    ]
    return {
        'lines': shown,
        'other': _amount(total - sum(sums, ZERO)),
        'total': _amount(total),
    }


def _charge_types(event):
    rows = {}
    charges = models.CustomCharge.objects.filter(
        registration__event=event).select_related('custom_charge_type')
    for charge in charges:
        charge_type = charge.custom_charge_type
        own = charge.camper_id is None
        key = (own, charge_type.id)
        row = rows.setdefault(key, {
            'type': charge_type.name, 'label': charge_type.label or charge_type.name,
            'registration_own': own, 'count': 0, 'amount': ZERO,
        })
        row['count'] += 1
        row['amount'] += invoices.money(charge.amount)
    ordered = sorted(rows.values(), key=lambda row: (row['registration_own'], row['label'].lower()))
    return [{**row, 'amount': _amount(row['amount'])} for row in ordered]


def _payment_types(event):
    rows = {}
    paypal_fees = ZERO
    for payment in models.Payment.objects.filter(registration__event=event):
        amount = invoices.money(payment.amount)
        row = rows.setdefault(payment.payment_type, {
            'type': payment.payment_type,
            'label': models.payment_type_label(payment.payment_type, event),
            'payments': 0, 'refunds': 0, 'received': ZERO, 'refunded': ZERO,
        })
        if amount < 0:
            row['refunds'] += 1
            row['refunded'] -= amount
        else:
            row['payments'] += 1
            row['received'] += amount
            if payment.paypal_response:
                paypal_fees += pricing.paypal_fee(payment)
    order = [choice['value'] for choice in event.payment_type_choices]
    ordered = sorted(
        rows.values(),
        key=lambda row: (order.index(row['type']) if row['type'] in order else len(order),
                         row['label'].lower()))
    return [
        {**row, 'received': _amount(row['received']), 'refunded': _amount(row['refunded']),
         'net': _amount(row['received'] - row['refunded'])}
        for row in ordered
    ], paypal_fees


def payments_totals(event):
    '''The event's money in totals: see the module's docstring.'''
    registrations = list(models.Registration.objects.filter(event=event).order_by('id'))
    ledgers = invoices.ledgers(registrations).values()
    price = sum((ledger.price for ledger in ledgers), ZERO)
    handling = sum((ledger.handling_charges for ledger in ledgers), ZERO)
    received = sum((ledger.total_paid for ledger in ledgers), ZERO)
    payment_types, paypal_fees = _payment_types(event)
    charge_types = _charge_types(event)
    cancellation_fees = [
        row for row in charge_types
        if row['registration_own'] and row['type'] == models.CustomChargeType.CANCELLATION_FEE]
    return {
        'registrations': len(registrations),
        'summary': {
            'price': _amount(price),
            'handling': _amount(handling),
            'owed': _amount(price + handling),
            'received': _amount(received),
            'balance': _amount(price + handling - received),
            'still_owed': _amount(sum((max(ZERO, ledger.balance) for ledger in ledgers), ZERO)),
            'refunds_due': _amount(sum((max(ZERO, -ledger.balance) for ledger in ledgers), ZERO)),
            'not_invoiced': _amount(sum((ledger.uninvoiced_balance for ledger in ledgers), ZERO)),
        },
        'charges': _charges(event, registrations),
        'charge_types': charge_types,
        'cancellation_fees': {
            'count': sum(row['count'] for row in cancellation_fees),
            'amount': _amount(sum((Decimal(row['amount']) for row in cancellation_fees), ZERO)),
        },
        'payment_types': payment_types,
        'online_fees': {
            'handling': _amount(handling),
            'paypal_fees': _amount(paypal_fees),
            'difference': _amount(handling - paypal_fees),
        },
    }

from collections import defaultdict
import numbers
import math
from datetime import datetime, date, time
from django.utils import timezone
from json_logic import jsonLogic
from camphoric import models


def money_fmt(amt):
    if isinstance(amt, numbers.Number):
        return round(amt, 2)
    return amt


# The e-payment handling fee's line, worked out after everything else.
HANDLING = 'handling'
HANDLING_LABEL = 'Electronic payment handling'

# A promo code's discount line, worked out after every other line but handling
# (SPEC DR-67), labelled with the code's own label.
PROMO = 'promo'
PROMO_LABEL = 'Promo code'


def line_label(event, var, camper=False):
    '''A pricing line's label, from the event's logic (or the var itself).'''
    if var == HANDLING and not camper:
        return HANDLING_LABEL
    if var == PROMO:
        return PROMO_LABEL
    logic = event.camper_pricing_logic if camper else event.registration_pricing_logic
    for component in logic or []:
        if component.get('var') == var:
            return component.get('label') or var
    return var


def overridable_lines(event, camper=False):
    '''The vars a registrar may override (SPEC DR-56): every line but the total.'''
    logic = event.camper_pricing_logic if camper else event.registration_pricing_logic
    lines = [c['var'] for c in logic or [] if c.get('var') and c['var'] != 'total']
    if not camper and event.epayment_handling:
        lines.append(HANDLING)
    return lines


def _load_overrides(registration):
    '''{(camper id or None, var): amount} for a saved registration.'''
    if registration.pk is None:
        return {}
    return {
        (override.camper_id, override.var): override.amount
        for override in models.PricingOverride.objects.filter(registration_id=registration.pk)
    }


def _as_number(amount):
    '''A stored Decimal as the plain number pricing works in.'''
    return int(amount) if amount == amount.to_integral_value() else float(amount)


def _override(overrides, camper_id, var, value, overridden):
    '''The line's value, or its override (noting the computed value it replaces).'''
    if var == 'total' or (camper_id, var) not in overrides:
        return value
    overridden[var] = value
    return _as_number(overrides[(camper_id, var)])


def _is_amount(value):
    return isinstance(value, numbers.Number) and not isinstance(value, bool)


def _floored(total):
    '''A total, never below zero (SPEC §9.2, DR-68); a non-number is left as it is.'''
    return 0 if _is_amount(total) and total < 0 else total


def promo_discount(logic, data, cap):
    '''
    The discount a promo code's logic works out: a positive amount, never more
    than `cap` (so it can't add a charge or take the total below zero).
    '''
    value = jsonLogic(logic, data)
    if not _is_amount(value) or math.isnan(value):
        return 0
    return money_fmt(max(0, min(value, cap)))


def _negated(discount):
    '''A discount as its (negative) price line, without a negative zero.'''
    return -discount if discount else 0


def _apply_promo(promo_code, data, results, camper_contexts):
    '''
    Subtract the promo code's discount from the total (SPEC §9.2, DR-67). A
    registration-scoped code sees the registration's lines (camper lines summed);
    a camper-scoped one is worked out in each camper's context, with that
    camper's own lines, and shows on the camper's breakdown too.
    '''
    remaining = max(0, results['total'] or 0)
    if promo_code.scope == models.PromoCodeScope.CAMPER:
        discount = 0
        for camper_data, camper_results in zip(camper_contexts, results['campers']):
            camper_total = camper_results.get('total')
            cap = min(camper_total, remaining) if _is_amount(camper_total) else remaining
            camper_discount = promo_discount(
                promo_code.pricing_logic, {**data, **camper_results, 'camper': camper_data},
                max(0, cap))
            camper_results[PROMO] = _negated(camper_discount)
            if _is_amount(camper_total):
                camper_results['total'] = money_fmt(camper_total - camper_discount)
            remaining -= camper_discount
            discount += camper_discount
    else:
        registration_lines = {var: value for var, value in results.items() if var != 'campers'}
        discount = promo_discount(
            promo_code.pricing_logic, {**data, **registration_lines}, remaining)
    results[PROMO] = _negated(money_fmt(discount))
    results['total'] = money_fmt((results['total'] or 0) - discount)


def calculate_price(registration, campers):
    '''
    Parameters
    ----------
    registration: camphoric.models.Registration
    campers: [camphoric.models.Camper]

    In order to calculate the price without writing to the database,
    campers are passed as a separate array.

    The registration_pricing_logic and camper_pricing_logic of corresponding
    Event are expected to have the following structure:
        [
            {
                "label": "Optional Label",
                "var": "variable_name",
                "exp": {"JsonLogic expression http://jsonlogic.com/"}
            },
            {
                "label": ..., "var": ..., "exp": ...,
            },
            ...
        ]
    Every JsonLogic expression can refer to variables defined by
    previous components.

    A registrar's overrides (models.PricingOverride, SPEC DR-56) replace a line
    right after it's worked out, so later lines use the new amount; the values
    they replaced are under `overridden`, for the admin only.

    No total is negative (SPEC DR-68): each camper's `total` is floored at
    zero as it's worked out, and so is the registration's once every camper's
    total is in, so a credit bigger than what it comes off (a campership for a
    camper who's free, say) can't leave the camp owing the registrant.

    The registration's promo code, if any, then takes its discount off the
    total as a negative `promo` line (and on each camper's breakdown, for a
    per-camper code), before the e-payment handling fee (SPEC DR-67).

    See server/tests/test_pricing.py for examples.

    Returns
    -------
    dict:
        keys: registration level components, camper level components, 'campers'
        values: subtotals of respective components, campers (list of dicts with
            camper components)

        This should produce identical results to `calculatePrice` in
        client_v2/src/pricing/calculatePrice.ts (and the legacy
        client/src/components/RegisterPage/utils.ts, which has no promo codes).
    '''
    results = defaultdict(int)
    results['campers'] = []
    event = registration.event
    registration_type = registration.registration_type

    data = {
        "registration": {
            **(registration.attributes or {}),
            "registration_type": registration_type.name if registration_type else None,
            # during registration process, created_at may be None
            "created_at": datetime_to_dict(registration.created_at or timezone.now()),
        },
        "pricing": event.pricing,
        "event": get_event_attributes(event),
        "date": datetime_to_dict(timezone.now()),
    }

    date_props = get_date_props(event.camper_schema)
    overrides = _load_overrides(registration)
    overridden = {}
    camper_contexts = []

    for reg_component in event.registration_pricing_logic:
        var = reg_component["var"]
        value = money_fmt(jsonLogic(reg_component["exp"], data))
        value = _override(overrides, None, var, value, overridden)
        results[var] = value
        data[var] = value

    for i, camper in enumerate(campers):
        data["camper"] = {}  # default if no camper.attributes

        if camper.attributes:
            data["camper"] = camper.attributes.copy()

        if camper.admin_attributes:
            data["camper"]["admin_attributes"] = camper.admin_attributes.copy()

        data["camper"]["index"] = i
        for date_prop in date_props:
            if date_prop in data["camper"]:
                data["camper"][date_prop] = datestring_to_dict(data["camper"][date_prop])

        lodging = None
        choices = []

        # determine which lodging record to use for price calculation
        if camper.lodging:
            lodging = camper.lodging
        elif camper.lodging_requested:
            lodging = camper.lodging_requested
        elif camper.lodging_requested_id:
            lodging = models.Lodging.objects.get(id=camper.lodging_requested_id)

        if lodging:
            choices = list(map(lambda ld: ld.id, lodging.get_parents()[1:]))

        # Mimic the data structure at the time of registration
        data["camper"]["lodging"] = {
            "lodging_requested": {
                "choices": choices,
                "id": lodging.id if lodging else 0,
                "name": lodging.name if lodging else '',
            }
        }

        # A camper that isn't saved yet (pricing during registration) has no charges.
        custom_charges = (
            list(models.CustomCharge.objects.filter(camper=camper).values())
            if camper.pk is not None else []
        )
        data["camper"]["custom_charges"] = custom_charges

        camper_results = {}
        camper_overridden = {}
        for camper_component in event.camper_pricing_logic:
            var = camper_component["var"]
            value = jsonLogic(camper_component["exp"], data)
            value = _override(overrides, camper.pk, var, value, camper_overridden)
            if var == 'total':
                value = _floored(value)
            camper_results[var] = value
            if isinstance(value, numbers.Number):
                results[var] = money_fmt((results[var] or 0) + value)
            data[var] = value

        if camper_overridden:
            camper_results['overridden'] = camper_overridden
        results['campers'].append(camper_results)
        camper_contexts.append(data["camper"])

    data.pop("camper", None)
    if 'total' in results:
        results['total'] = _floored(results['total'])
    if registration.promo_code is not None:
        _apply_promo(registration.promo_code, data, results, camper_contexts)

    if event.epayment_handling and registration.payment_type != 'Check':
        handling = money_fmt(results['total'] * (float(event.epayment_handling) / 100))
        handling = _override(overrides, None, HANDLING, handling, overridden)
        results[HANDLING] = handling
        results['total'] = results['total'] + handling

    if overridden:
        results['overridden'] = overridden
    return dict(results)


def datetime_to_dict(d):
    # add time if only date type not datetime
    if isinstance(d, date) and "timestamp" not in dir(d):
        d = datetime.combine(d, time(0, 0, 0, 0))

    return {
        "epoch": math.floor(d.timestamp() if d else 0),
        "year": d.year if d else 0,
        "month": d.month if d else 0,
        "day": d.day if d else 0,
    }


def datestring_to_dict(s):
    y, m, d = [int(x) for x in s.split("-")]
    return {
        "year": y,
        "month": m,
        "day": d,
    }


def get_date_props(camper_schema):
    if not camper_schema:
        return []
    date_props = []
    for prop_name, prop_schema in camper_schema["properties"].items():
        if prop_schema.get("type") == "string" and prop_schema.get("format") == "date":
            date_props.append(prop_name)
    return date_props


def get_event_attributes(event):
    attributes = {'is_open': event.is_open()}
    if (event.epayment_handling):
        attributes['epayment_handling'] = event.epayment_handling

    for field in ["registration_start", "registration_end", "start", "end"]:
        if getattr(event, field):
            attributes[field] = datetime_to_dict(getattr(event, field))
    return attributes

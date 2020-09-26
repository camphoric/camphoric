from collections import defaultdict
import numbers

from json_logic import jsonLogic


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

    See server/tests/test_pricing.py for examples.

    Returns
    -------
    dict:
        keys: registration level components, camper level components, 'campers'
        values: subtotals of respective components, campers (list of dicts with
            camper components)
    '''
    results = defaultdict(int)
    results['campers'] = []
    event = registration.event

    data = {
        "registration": registration.attributes,
        "pricing": event.pricing,
        "event": {},
    }

    for field in ["registration_start", "registration_end", "start", "end"]:
        if getattr(event, field):
            data["event"][field] = datetime_to_dict(getattr(event, field))

    date_props = get_date_props(event.camper_schema)

    for reg_component in event.registration_pricing_logic:
        var = reg_component["var"]
        value = jsonLogic(reg_component["exp"], data)
        results[var] = value
        data[var] = value

    for camper in campers:
        data["camper"] = camper.attributes.copy()
        for date_prop in date_props:
            data["camper"][date_prop] = datestring_to_dict(data["camper"][date_prop])

        camper_results = {}
        for camper_component in event.camper_pricing_logic:
            var = camper_component["var"]
            value = jsonLogic(camper_component["exp"], data)
            camper_results[var] = value
            if isinstance(value, numbers.Number):
                results[var] += value
            data[var] = value

        results['campers'].append(camper_results)

    return dict(results)


def datetime_to_dict(d):
    return {
        "year": d.year,
        "month": d.month,
        "day": d.day,
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

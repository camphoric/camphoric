from collections import defaultdict
import numbers
from datetime import datetime, date, time
from json_logic import jsonLogic
from camphoric import models


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

        This should produce identical results to `calculatePrice` in
        client/src/components/RegisterPage/utils.ts.
    '''
    results = defaultdict(int)
    results['campers'] = []
    event = registration.event
    registration_type = registration.registration_type

    data = {
        "registration": {
            **(registration.attributes or {}),
            "registration_type": registration_type.name if registration_type else None,
            "created_at": datetime_to_dict(registration.created_at),
        },
        "pricing": event.pricing,
        "event": get_event_attributes(event),
        "date": datetime_to_dict(datetime.now()),
    }

    date_props = get_date_props(event.camper_schema)

    for reg_component in event.registration_pricing_logic:
        var = reg_component["var"]
        value = jsonLogic(reg_component["exp"], data)
        results[var] = value
        data[var] = value

    for i, camper in enumerate(campers):
        data["camper"] = {}  # default if no camper.attributes

        if camper.attributes:
            data["camper"] = camper.attributes.copy()

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

        camper_results = {}
        for camper_component in event.camper_pricing_logic:
            var = camper_component["var"]
            value = jsonLogic(camper_component["exp"], data)
            camper_results[var] = value
            if isinstance(value, numbers.Number):
                results[var] = (results[var] or 0) + value
            data[var] = value

        results['campers'].append(camper_results)

    return dict(results)


def datetime_to_dict(d):
    # add time if only date type
    if isinstance(d, date):
        d = datetime.combine(d, time(0, 0, 0, 0))

    return {
        "epoch": d.timestamp() if d else 0,
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
    for field in ["registration_start", "registration_end", "start", "end"]:
        if getattr(event, field):
            attributes[field] = datetime_to_dict(getattr(event, field))
    return attributes

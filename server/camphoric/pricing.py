from collections import defaultdict
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
    }
    for reg_component in event.registration_pricing_logic:
        var = reg_component["var"]
        value = jsonLogic(reg_component["exp"], data)
        results[var] = value
        data[var] = value

    for camper in campers:
        data["camper"] = camper.attributes
        camper_results = {}

        for camper_component in event.camper_pricing_logic:
            var = camper_component["var"]
            value = jsonLogic(camper_component["exp"], data)
            camper_results[var] = value
            results[var] += value
            data[var] = value

        results['campers'].append(camper_results)

    return dict(results)

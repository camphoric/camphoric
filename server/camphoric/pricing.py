from collections import defaultdict
from json_logic import jsonLogic


def calculate_price(registration, campers):
    '''
    Parameters
    ----------
    registration: camphoric.models.Registration
    campers: [camphoric.models.Camper]

    In order to calculate the price without writing to the database, campers are passed as a
    separate array.

    Returns
    -------
    dict:
        keys: registration level components, camper level components and total.
        values: subtotals of respective components and the total.
    '''
    results = defaultdict(int)
    event = registration.event

    data = {
        "registration": registration.attributes,
        "pricing": event.pricing
    }
    for reg_component, logic in event.registration_pricing_logic.items():
        results[reg_component] = jsonLogic(logic, data)

    for camper in campers:
        camper_data = {
            "registration": registration.attributes,
            "pricing": event.pricing,
            "camper": camper.attributes
        }
        for camper_component, logic in event.camper_pricing_logic.items():
            results[camper_component] += jsonLogic(logic, camper_data)

    results['total'] = sum(results.values())

    return dict(results)

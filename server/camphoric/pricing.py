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

    See server/tests/test_pricing.py for examples.

    Returns
    -------
    dict:
        keys: registration level components, camper level components, 'campers',
            and 'total'
        values: subtotals of respective components, campers (list of dicts with
            camper components and totals) and the total
    '''
    results = defaultdict(int)
    results['campers'] = []
    event = registration.event

    data = {
        "registration": registration.attributes,
        "pricing": event.pricing
    }
    for reg_component, logic in event.registration_pricing_logic.items():
        amount = jsonLogic(logic, data)
        results[reg_component] = amount
        results['total'] += amount

    for camper in campers:
        camper_data = {
            "registration": registration.attributes,
            "pricing": event.pricing,
            "camper": camper.attributes
        }
        camper_results = defaultdict(int)

        for camper_component, logic in event.camper_pricing_logic.items():
            amount = jsonLogic(logic, camper_data)
            camper_results[camper_component] = amount
            camper_results['total'] += amount
            results[camper_component] += amount
            results['total'] += amount

        results['campers'].append(camper_results)

    return dict(results)

from collections import defaultdict
import re

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
        'registration': {
            **(registration.attributes or {}),
            **get_int_dates(registration.attributes),
        },
        'pricing': event.pricing
    }

    if event.start:
        data['start_date_int'] = int(event.start.strftime('%Y%m%d'))

    for reg_component, logic in event.registration_pricing_logic.items():
        amount = jsonLogic(logic, data)
        results[reg_component] = amount
        results['total'] += amount

    for camper in campers:
        data['camper'] = {
            **camper.attributes,
            **get_int_dates(camper.attributes),
        }
        camper_results = defaultdict(int)

        for camper_component, logic in event.camper_pricing_logic.items():
            amount = jsonLogic(logic, data)
            camper_results[camper_component] = amount
            camper_results['total'] += amount
            results[camper_component] += amount
            results['total'] += amount

        results['campers'].append(camper_results)

    return dict(results)


looks_like_date = re.compile(r'^\d{4}-\d\d-\d\d$')


def get_int_dates(attributes):
    if not attributes:
        return {}
    result = {}
    for k, v in attributes.items():
        if isinstance(v, str) and looks_like_date.match(v):
            results[f'{k}_int'] = int(v.replace('-', ''))
    return result

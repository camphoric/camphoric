'''
Functions for calculating the `computed_attributes` fields of Registration and
Camper using the corresponding JsonLogic formulas in the Event.

Computed attributes are useful as intermediate variables in price calculations
and for inclusion in confirmation emails and reports.

The current use case is calculating the age of each camper based on the entered
birthdate. To enable this use case, this code makes available to JsonLogic an
integer representation of various date fields:
- event.start, as event.start_yyyymmdd
- top-level camper attributes in YYYY-MM-DD format, as camper.<attr>_yyyymmdd
The integer value looks like, for example, 20201103 (for '2020-11-03').

Also to support the 'age' use case, all floating-point values are truncated.

See server/tests/test_computed_attributes.py for examples.
'''

import re

from json_logic import jsonLogic


def calculate_computed_attributes(registration, campers):
    '''
    Parameters
    ----------
    registration: camphoric.models.Registration
    campers: [camphoric.models.Camper]

    In order to calculate the price without writing to the database,
    campers are passed as a separate array.

    Returns
    -------
    tuple: (registration_computed_attributes, camper_computed_attributes)
        - each value is a dict
        - floating point values are truncated
    '''

    event = registration.event

    data = {
        'registration': registration.attributes,
        'event': {},
    }
    if event.start:
        data['event']['start_yyyymmdd'] = int(event.start.strftime('%Y%m%d'))

    registration_results = {
        k: truncate_if_float(jsonLogic(logic, data))
        for k, logic in event.registration_computed_attributes_logic.items()
    }

    camper_results = []
    for camper in campers:
        data['camper'] = {
            **camper.attributes,
            **get_int_dates(camper.attributes),
        }

        camper_results.append({
            k: truncate_if_float(jsonLogic(logic, data))
            for k, logic in event.camper_computed_attributes_logic.items()
        })


    return registration_results, camper_results


looks_like_date = re.compile(r'^\d{4}-\d\d-\d\d$')


def get_int_dates(attributes):
    result = {}
    for k, v in attributes.items():
        if isinstance(v, str) and looks_like_date.match(v):
            result[f'{k}_yyyymmdd'] = int(v.replace('-', ''))
    return result


def truncate_if_float(value):
    if isinstance(value, float):
        return int(value)
    return value

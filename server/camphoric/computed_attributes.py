'''
Functions for calculating the `computed_attributes` fields of Registration and
Camper using the corresponding JsonLogic formulas in the Event.

Computed attributes are useful as intermediate variables in price calculations
and for inclusion in confirmation emails and reports.

The current use case is calculating the age of each camper based on the entered
birthdate. To allow JsonLogic to work with dates, we pass them in as
{ year, month, day } objects. The available date variables are:

- event.start
- top-level camper attributes in YYYY-MM-DD format, appending '_date' to the
  name (e.g. camper.birthdate_date)

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
        data['event']['start'] = {
            'year': event.start.year,
            'month': event.start.month,
            'day': event.start.day,
        }

    registration_results = {
        k: jsonLogic(logic, data)
        for k, logic in event.registration_computed_attributes_logic.items()
    }

    camper_results = []
    for camper in campers:
        data['camper'] = {
            **camper.attributes,
            **get_dates(camper.attributes),
        }

        camper_results.append({
            k: jsonLogic(logic, data)
            for k, logic in event.camper_computed_attributes_logic.items()
        })


    return registration_results, camper_results


looks_like_date = re.compile(r'^\d{4}-\d\d-\d\d$')


def get_dates(attributes):
    result = {}
    for k, v in attributes.items():
        if isinstance(v, str) and looks_like_date.match(v):
            year, month, day = v.split('-')
            result[f'{k}_date'] = {
                'year': int(year),
                'month': int(month),
                'day': int(day),
            }
    return result

'''
Pricing parity (SPEC §9.2, DR-14): the server's `calculate_price` gives each
case in tests/data/pricing_parity.json exactly its expected results. The client's
`calculatePrice` runs the same file (client/src/pricing/test/pricingParity.test.ts),
so the two engines agree.
'''

import datetime
import json
from decimal import Decimal
from pathlib import Path
import unittest
from unittest import mock

from camphoric import models
from camphoric import pricing


FIXTURES = Path(__file__).parent / 'data' / 'pricing_parity.json'


def load_fixtures():
    with FIXTURES.open(encoding='utf-8') as fixtures_file:
        return json.load(fixtures_file)['fixtures']


def price(fixture):
    '''The fixture's registration, priced by the server as it's being registered.'''
    event_data = fixture['event']
    event = models.Event(
        name='Parity Camp',
        pricing=event_data['pricing'],
        camper_schema=event_data.get('camperSchema', {}),
        registration_pricing_logic=event_data['registrationPricingLogic'],
        camper_pricing_logic=event_data['camperPricingLogic'],
        epayment_handling=Decimal(str(event_data.get('epaymentHandling', 0))),
    )
    promo = fixture.get('promo')
    promo_code = promo and models.PromoCode(
        event=event, label='Promo', code='PROMO',
        scope=promo['scope'], pricing_logic=promo['pricingLogic'])
    registration = models.Registration(
        event=event, attributes=fixture['registration'], promo_code=promo_code)
    campers = [
        models.Camper(registration=registration, attributes=attributes)
        for attributes in fixture['campers']
    ]
    now = datetime.datetime.fromisoformat(fixture['now'])
    with mock.patch('django.utils.timezone.now', return_value=now):
        return pricing.calculate_price(registration, campers)


def typed(value):
    '''
    The value with each boolean marked as one: Python has True == 1, but the
    client doesn't, so a line must be the same type on both sides.
    '''
    if isinstance(value, bool):
        return ('bool', value)
    if isinstance(value, dict):
        return {key: typed(item) for key, item in value.items()}
    if isinstance(value, list):
        return [typed(item) for item in value]
    return value


class TestPricingParity(unittest.TestCase):

    def test_fixtures(self):
        self.maxDiff = None
        fixtures = load_fixtures()
        self.assertTrue(fixtures)
        for fixture in fixtures:
            with self.subTest(fixture['name']):
                self.assertEqual(typed(price(fixture)), typed(fixture['expected']))

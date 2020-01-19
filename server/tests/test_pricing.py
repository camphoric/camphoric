import unittest

from json_logic import jsonLogic

from camphoric import models
from camphoric import pricing


class TestJsonLogic(unittest.TestCase):

    def test_operations(self):
        self.assertEqual(jsonLogic({"+": [2, 2]}), 4)
        self.assertEqual(
            jsonLogic(
                {"+": [{"var": "a"}, {"var": "b"}]},
                {"a": 3, "b": 2}),
            5
        )
        self.assertEqual(
            jsonLogic(
                {"if": [
                    {">": [{"var": "a"}, 5]}, 1,
                    0
                ]},
                {"a": 6}),
            1
        )
        logic = {
            "*": [
                {"reduce": [
                    {"var": "registration.parking_passes"},
                    {"+": [
                        {"var": "accumulator"},
                        1
                    ]},
                    0
                ]},
                {"var": "pricing.parking_pass"}
            ]
        }
        data = {
            "registration": {
                "parking_passes": ["honda", "volkswagen", "mercedes", "ford"]
            },
            "pricing": {
                "parking_pass": 10
            }
        }
        self.assertEqual(
            jsonLogic(logic, data), 40)


class TestCalculatePrice(unittest.TestCase):

    def setUp(self):
        self.organization = models.Organization(name="Test Organization")

    def test_calculate_registration(self):
        event = models.Event(
            organization=self.organization,
            name="Test Event",
            pricing={
                "cabin": 100,
                "parking_pass": 50
            },
            registration_pricing_logic={
                "cabins": {
                    "*": [
                        {"var": "registration.number_of_cabins"},
                        {"var": "pricing.cabin"},

                    ]
                },
                "parking_passes": {
                    "*": [
                        {"var": "registration.number_of_parking_passes"},
                        {"var": "pricing.parking_pass"}
                    ]
                }
            },
            camper_pricing_logic={}
        )
        registration = models.Registration(
            event=event,
            attributes={
                "number_of_cabins": 3,
                "number_of_parking_passes": 2
            }
        )
        registration_price = pricing.calculate_price(registration)
        self.assertEqual(registration_price, {
            "cabins": 300,
            "parking_passes": 100,
            "total": 400,
        })

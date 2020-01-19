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
        self.registration_pricing_logic={
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
        }
        self.camper_pricing_logic = {
            "tuition": {
                "if": [
                    {">=": [{"var": "camper.age"}, 18]},
                    {"var": "pricing.tuition_adult"},
                    {"var": "pricing.tuition_child"}
                ]
            },
            "meals": {
                "if": [
                    {">=": [{"var": "camper.age"}, 18]},
                    {"var": "pricing.meals_adult"},
                    {"var": "pricing.meals_child"}
                ]
            }
        }
        self.pricing = {
            "cabin": 100,
            "parking_pass": 50,
            "tuition_adult": 400,
            "tuition_child": 200,
            "meals_adult": 300,
            "meals_child": 50,
        }

    def test_calculate_registration(self):
        event = models.Event(
            organization=self.organization,
            name="Test Registration Event",
            pricing=self.pricing,
            registration_pricing_logic = self.registration_pricing_logic,
            camper_pricing_logic={}
        )
        registration = models.Registration(
            event=event,
            attributes={
                "number_of_cabins": 3,
                "number_of_parking_passes": 2
            }
        )
        price_components = pricing.calculate_price(registration,[])
        self.assertEqual(price_components, {
            "cabins": 300,
            "parking_passes": 100,
            "total": 400,
        })

    def test_calculate_campers(self):
        event = models.Event(
            organization=self.organization,
            name="Test Camper Event",
            pricing=self.pricing,
            registration_pricing_logic = {},
            camper_pricing_logic = self.camper_pricing_logic
        )
        registration = models.Registration(event=event)
        campers = [
            models.Camper(attributes={"age": 2}),
            models.Camper(attributes={"age": 17}),
            models.Camper(attributes={"age": 18}),
            models.Camper(attributes={"age": 42})
            ]
        price_components = pricing.calculate_price(registration, campers)
        self.assertEqual(price_components, {
            "tuition": 1200,
            "meals": 700,
            "total": 1900,
        })

    def test_campers_and_registration(self):
        event = models.Event(
            organization=self.organization,
            name="Test Camper/Registration Event",
            pricing=self.pricing,
            registration_pricing_logic = self.registration_pricing_logic,
            camper_pricing_logic = self.camper_pricing_logic
        )
        registration = models.Registration(
            event=event,
            attributes={
                "number_of_cabins": 3,
                "number_of_parking_passes": 2
            }
        )
        campers = [
            models.Camper(attributes={"age": 2}),
            models.Camper(attributes={"age": 17}),
            models.Camper(attributes={"age": 18}),
            models.Camper(attributes={"age": 42})
            ]
        price_components = pricing.calculate_price(registration, campers)
        self.assertEqual(price_components, {
            "tuition": 1200,
            "meals": 700,
            "cabins": 300,
            "parking_passes": 100,
            "total": 2300,
        })

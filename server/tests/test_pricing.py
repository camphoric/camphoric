import datetime
import unittest

from django.utils import timezone
from json_logic import jsonLogic

from camphoric import models
from camphoric import pricing


class TestJsonLogic(unittest.TestCase):

    def test_array(self):
        self.assertEqual(
            jsonLogic([{"var": "a"}, {"var": "b"}], {"a": 1, "b": 2}),
            [1, 2]
        )

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
                "parking_pass": 10,
            }
        }
        self.assertEqual(
            jsonLogic(logic, data), 40)


class TestCalculatePrice(unittest.TestCase):

    def setUp(self):
        self.organization = models.Organization(name="Test Organization")
        self.registration_pricing_logic = [
            {
                "label": "Cabins",
                "var": "cabins",
                "exp": {
                    "*": [
                        {"var": "registration.number_of_cabins"},
                        {"var": "pricing.cabin"},
                    ]
                },
            },
            {
                "label": "Parking Passes",
                "var": "parking_passes",
                "exp": {
                    "*": [
                        {"var": "registration.number_of_parking_passes"},
                        {"var": "pricing.parking_pass"}
                    ]
                },
            },
            {
                "label": "Total",
                "var": "total",
                "exp": {
                    "+": [
                        {"var": "cabins"},
                        {"var": "parking_passes"}
                    ]
                },
            },
        ]
        self.camper_pricing_logic = [
            {
                "label": "Is Adult",
                "var": "is_adult",
                "exp": {">=": [{"var": "camper.age"}, 18]},
            },
            {
                "label": "Tuition",
                "var": "tuition",
                "exp": {
                    "if": [
                        {"var": "is_adult"},
                        {"var": "pricing.tuition_adult"},
                        {"var": "pricing.tuition_child"}
                    ]
                },
            },
            {
                "label": "Meals",
                "var": "meals",
                "exp": {
                    "if": [
                        {"var": "is_adult"},
                        {"var": "pricing.meals_adult"},
                        {"var": "pricing.meals_child"}
                    ]
                },
            },
            {
                "label": "Camper total",
                "var": "total",
                "exp": {
                    "+": [
                        {"var": "tuition"},
                        {"var": "meals"}
                    ]
                },
            },
        ]
        self.pricing = {
            "cabin": 100,
            "parking_pass": 50,
            "tuition_adult": 400,
            "tuition_child": 200,
            "meals_adult": 300,
            "meals_child": 50,
        }

    def test_dates(self):
        event = models.Event(
            organization=self.organization,
            name="Test Registration Event",
            start=datetime.datetime(2019, 2, 25, 17, 0, 5, tzinfo=timezone.utc),
            camper_schema={
                "type": "object",
                "properties": {
                    "birthdate": {
                        "type": "string",
                        "format": "date",
                    },
                },
            },
            pricing=self.pricing,
            registration_pricing_logic=[
                {
                    "var": "date_parts",
                    "exp": [
                        {"var": "event.start.year"},
                        {"var": "event.start.month"},
                        {"var": "event.start.day"},
                    ],
                },
            ],
            camper_pricing_logic=[
                {
                    "var": "birthdate_parts",
                    "exp": [
                        {"var": "camper.birthdate.year"},
                        {"var": "camper.birthdate.month"},
                        {"var": "camper.birthdate.day"},
                    ],
                },
            ],
        )
        self.assertIsNotNone(event.start)
        registration = models.Registration(
            event=event,
            attributes={}
        )
        camper = models.Camper(
            registration=registration,
            attributes={
                "birthdate": "2000-12-31",
            },
        )
        price_components = pricing.calculate_price(registration, [camper])
        self.assertEqual(price_components, {
            "date_parts": [2019, 2, 25],
            "campers": [{"birthdate_parts": [2000, 12, 31]}],
        })

    def test_calculate_registration(self):
        event = models.Event(
            organization=self.organization,
            name="Test Registration Event",
            pricing=self.pricing,
            registration_pricing_logic=self.registration_pricing_logic,
            camper_pricing_logic=[],
        )
        registration = models.Registration(
            event=event,
            attributes={
                "number_of_cabins": 3,
                "number_of_parking_passes": 2,
            }
        )
        price_components = pricing.calculate_price(registration, [])
        self.assertEqual(price_components, {
            "cabins": 300,
            "parking_passes": 100,
            "campers": [],
            "total": 400,
        })

    def test_calculate_campers(self):
        event = models.Event(
            organization=self.organization,
            name="Test Camper Event",
            pricing=self.pricing,
            registration_pricing_logic=[],
            camper_pricing_logic=self.camper_pricing_logic,
        )
        registration = models.Registration(event=event)
        campers = [
            models.Camper(attributes={"age": 2}),
            models.Camper(attributes={"age": 17}),
            models.Camper(attributes={"age": 18}),
            models.Camper(attributes={"age": 42}),
        ]
        price_components = pricing.calculate_price(registration, campers)
        self.assertEqual(price_components, {
            "is_adult": 2,
            "tuition": 1200,
            "meals": 700,
            "campers": [
                {"is_adult": False, "meals": 50, "total": 250, "tuition": 200},
                {"is_adult": False, "meals": 50, "total": 250, "tuition": 200},
                {"is_adult": True, "meals": 300, "total": 700, "tuition": 400},
                {"is_adult": True, "meals": 300, "total": 700, "tuition": 400},
            ],
            "total": 1900,
        })

    def test_campers_and_registration(self):
        event = models.Event(
            organization=self.organization,
            name="Test Camper/Registration Event",
            pricing=self.pricing,
            registration_pricing_logic=self.registration_pricing_logic,
            camper_pricing_logic=self.camper_pricing_logic,
        )
        registration = models.Registration(
            event=event,
            attributes={
                "number_of_cabins": 3,
                "number_of_parking_passes": 2,
            }
        )
        campers = [
            models.Camper(attributes={"age": 2}),
            models.Camper(attributes={"age": 17}),
            models.Camper(attributes={"age": 18}),
            models.Camper(attributes={"age": 42}),
        ]
        price_components = pricing.calculate_price(registration, campers)
        self.assertEqual(price_components, {
            "is_adult": 2,
            "tuition": 1200,
            "meals": 700,
            "cabins": 300,
            "parking_passes": 100,
            "campers": [
                {"is_adult": False, "meals": 50, "total": 250, "tuition": 200},
                {"is_adult": False, "meals": 50, "total": 250, "tuition": 200},
                {"is_adult": True, "meals": 300, "total": 700, "tuition": 400},
                {"is_adult": True, "meals": 300, "total": 700, "tuition": 400},
            ],
            "total": 2300,
        })

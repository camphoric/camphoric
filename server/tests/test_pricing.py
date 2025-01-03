import datetime
import unittest
import math

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


def camperf(i, custom_charges, is_adult, meals, tuition, total):
    return {
            "i": i,
            "custom_charges": custom_charges,
            "is_adult": is_adult,
            "meals": meals,
            "total": total,
            "tuition": tuition}


class TestCalculatePrice(unittest.TestCase):

    def setUp(self):
        self.maxDiff = None
        self.organization = models.Organization.objects.create(name="Test Organization")
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
                "var": "i",
                "exp": {"var": "camper.index"},
            },
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
                "label": "Custom Charges",
                "var": "custom_charges",
                "exp": {
                    "reduce": [
                        {"var": "camper.custom_charges"},
                        {"+": [{"var": "current.amount"}, {"var": "accumulator"}]},
                        0
                    ]
                },
            },
            {
                "label": "Camper total",
                "var": "total",
                "exp": {
                    "+": [
                        {"var": "tuition"},
                        {"var": "custom_charges"},
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

    def test_early_reg(self):
        early_reg = timezone.now() - datetime.timedelta(days=1)
        event = models.Event(
                organization=self.organization,
                name="Test Registration Event",
                start=datetime.datetime(2019, 2, 25, 17, 0, 5, tzinfo=timezone.utc),
                camper_schema={
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            },
                        },
                    },
                pricing={
                    "early": 100,
                    "late": 200,
                    },
                registration_pricing_logic=[],
                camper_pricing_logic=[
                    {
                        "var": "total",
                        "exp": {"if": [
                            {"<": [
                                {"var": "registration.created_at.epoch"},
                                math.floor(early_reg.timestamp())
                                ],
                             },
                            {"var": "pricing.early"},
                            {"var": "pricing.late"},
                            ]},
                        }
                          ],
                )

        registration = models.Registration(
                event=event,
                attributes={}
                )
        camper = models.Camper(
                registration=registration,
                attributes={"name": "John Blaze"},
                )

        # Since we set early reg to a day ago, this should be late reg pricing
        # when registration.created_at = None.
        self.assertEqual(registration.created_at, None)
        price_components = pricing.calculate_price(registration, [camper])
        self.assertEqual(price_components, {'campers': [{'total': 200}], 'total': 200})

        # created one day ago
        registration.created_at = timezone.now() - datetime.timedelta(days=2)
        price_components = pricing.calculate_price(registration, [camper])
        self.assertEqual(price_components, {'campers': [{'total': 100}], 'total': 100})

        # created one day in the future
        registration.created_at = timezone.now() + datetime.timedelta(days=2)
        price_components = pricing.calculate_price(registration, [camper])
        self.assertEqual(price_components, {'campers': [{'total': 200}], 'total': 200})

    def test_birthday_dates(self):
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

    def test_calculate_custom_charges(self):
        event = models.Event(
                organization=self.organization,
                name="Test Registration Event",
                pricing=self.pricing,
                registration_pricing_logic=self.registration_pricing_logic,
                camper_pricing_logic=self.camper_pricing_logic,
                )
        event.save()
        custom_charge_type = models.CustomChargeType(
                event=event,
                label="Extra bedding charge"
                )
        custom_charge_type.save()
        registration = models.Registration(
                event=event,
                attributes={
                    "number_of_cabins": 3,
                    "number_of_parking_passes": 2,
                    }
                )
        registration.save()
        camper = models.Camper(registration=registration)
        custom_charge = models.CustomCharge(
                custom_charge_type=custom_charge_type,
                camper=camper,
                amount=25
                )
        camper.save()
        custom_charge.save()
        price_components = pricing.calculate_price(registration, [camper])
        self.assertEqual(custom_charge.amount, 25)
        self.assertEqual({
            "cabins": 300,
            "parking_passes": 100,
            "i": 0,
            "is_adult": 0,
            "meals": 50,
            "custom_charges": 25,
            "tuition": 200,
            "campers": [camperf(0, 25, False, 50, 200, 275)],
            "total": 675,
            }, price_components)

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
            "i": 6,
            "is_adult": 2,
            "tuition": 1200,
            "meals": 700,
            "custom_charges": 0,
            "campers": [
                camperf(0, 0, False, 50, 200, 250),
                camperf(1, 0, False, 50, 200, 250),
                camperf(2, 0, True, 300, 400, 700),
                camperf(3, 0, True, 300, 400, 700),
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
            "i": 6,
            "is_adult": 2,
            "tuition": 1200,
            "meals": 700,
            "cabins": 300,
            "parking_passes": 100,
            "custom_charges": 0,
            "campers": [
                camperf(0, 0, False, 50, 200, 250),
                camperf(1, 0, False, 50, 200, 250),
                camperf(2, 0, True,  300, 400, 700),
                camperf(3, 0, True,  300, 400, 700),
            ],
            "total": 2300,
        })

    def test_registration_type(self):
        event = models.Event(
            organization=self.organization,
            name="Test Registration Event",
            pricing=self.pricing,
            registration_pricing_logic=[
                {
                    'var': 'total',
                    'exp': {
                        'if': [
                            {'==': [
                                {'var': 'registration.registration_type'},
                                'worktrade',
                            ]},
                            100,
                            200,
                        ]
                    },
                },
            ],
            camper_pricing_logic=[],
        )

        # default registration type (None)
        registration = models.Registration(
            event=event,
            attributes={},
        )
        price_components = pricing.calculate_price(registration, [])
        self.assertEqual(price_components, {
            'campers': [],
            'total': 200,
        })

        # 'worktrade' registration type
        registration = models.Registration(
            event=event,
            attributes={},
            registration_type=models.RegistrationType(
                event=event,
                name='worktrade',
                label='Work-trade',
            ),
        )
        price_components = pricing.calculate_price(registration, [])
        self.assertEqual(price_components, {
            'campers': [],
            'total': 100,
        })

    def test_camper_lodging(self):
        event = models.Event.objects.create(
            organization=self.organization,
            name="Test Registration Event",
            pricing={
                "cabin": 200,
                "tent": 100,
                "rv": 50,
                "offsite": 5,
            },
            registration_pricing_logic=[],
            camper_pricing_logic=[],
        )

        root = event.lodging_set.create(
            name='Test Lodging',
            children_title='Please select a lodging type',
            visible=True,
            notes=''
        )

        lodging_cabin = event.lodging_set.create(name='cabin', parent=root)
        lodging_tent = event.lodging_set.create(name='tent', parent=root)
        lodging_rv = event.lodging_set.create(name='rv', parent=root)
        lodging_offsite = event.lodging_set.create(name='offsite', parent=root)

        lodge_req_var = {"var": "camper.lodging.lodging_requested.choices"}
        event.camper_pricing_logic = [
            {
                "label": "Housing",
                "var": "housing",
                "exp": {
                    "if": [
                        {"in": [lodging_cabin.id, lodge_req_var]},
                        {"var": "pricing.cabin"},

                        {"in": [lodging_tent.id, lodge_req_var]},
                        {"var": "pricing.tent"},

                        {"in": [lodging_rv.id, lodge_req_var]},
                        {"var": "pricing.rv"},

                        {"in": [lodging_offsite.id, lodge_req_var]},
                        {"var": "pricing.offsite"},

                        0
                    ]
                },
            },
        ]
        event.save()

        registration = models.Registration.objects.create(
            event=event,
            attributes={},
        )

        # test with no housing
        camper = registration.campers.create()
        price_components = pricing.calculate_price(registration, [camper])
        self.assertEqual(
            price_components["campers"][0]["housing"],
            0,
        )

        # test with requested id
        camper.lodging_requested_id = lodging_cabin.id
        price_components = pricing.calculate_price(registration, [camper])
        self.assertEqual(
            price_components["campers"][0]["housing"],
            event.pricing["cabin"]
        )

        # test with requested overriding requested_id
        camper.lodging_requested = lodging_tent
        price_components = pricing.calculate_price(registration, [camper])
        self.assertEqual(
            price_components["campers"][0]["housing"],
            event.pricing["tent"]
        )

        # test with lodging overriding requested
        camper.lodging = lodging_rv
        price_components = pricing.calculate_price(registration, [camper])

        self.assertEqual(
            price_components["campers"][0]["housing"],
            event.pricing["rv"]
        )

        # test with lodging overriding lodging
        camper.lodging = lodging_offsite
        price_components = pricing.calculate_price(registration, [camper])
        self.assertEqual(
            price_components["campers"][0]["housing"],
            event.pricing["offsite"]
        )

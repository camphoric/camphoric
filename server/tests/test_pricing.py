import unittest

from json_logic import jsonLogic


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

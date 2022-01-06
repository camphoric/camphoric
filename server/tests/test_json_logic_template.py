import unittest

from camphoric.json_logic_template import render


class TestJsonLogicTemplate(unittest.TestCase):
    def single_string(self):
        template = ['hello world']
        self.assertEqual(render(template), 'hello world')

    def multi_strings(self):
        template = ['hello', 'world']
        self.assertEqual(render(template), 'hello world')

    def test_conditionals(self):
        template = [
            'generic text\n',
            {'if': [{'>': [{'var': 'foo'}, 0]}, 'something about foo\n', '']},
            'more generic text\n',
            {'if': [{'>': [{'var': 'bar'}, 0]}, 'something about bar\n', '']},
        ]
        data = {'foo': 1, 'bar': 0}
        self.assertEqual(
            render(template, data),
            'generic text\nsomething about foo\nmore generic text\n')

    def test_map(self):
        template = [
            {'var': 'parent_name'},
            '\n',
            {
                'map': [
                    {'var': 'kids'},
                    [{'var': 'name'}, ', age ', {'var': 'age'}, '\n']
                ]
            }
        ]
        data = {
            'parent_name': 'Bob',
            'kids': [
                {'name': 'Billy', 'age': 8},
                {'name': 'Suzy', 'age': 9},
            ]
        }
        self.assertEqual(render(template, data), """
Bob
Billy, age 8
Suzy, age 9
""".lstrip())

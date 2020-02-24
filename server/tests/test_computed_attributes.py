import datetime
import unittest

from django.utils import timezone 

from camphoric import models
from camphoric.computed_attributes import calculate_computed_attributes


class TestCalculateComputedAttributes(unittest.TestCase):
    def setUp(self):
        self.organization = models.Organization(name="Test Organization")

    def test_no_computed_attributes(self):
        event = models.Event(
            organization=self.organization,
            name='test')
        registration = models.Registration(event=event)
        campers = [models.Camper(), models.Camper()]

        self.assertEqual(
            calculate_computed_attributes(registration, campers),
            ({}, [{}, {}]))

    def test_registration_computed_attributes(self):
        event = models.Event(
            organization=self.organization,
            name='test',
            registration_computed_attributes_logic={
                'y': {'*': [{'var': 'registration.x'}, 2]}
            },
        )
        registration = models.Registration(
            event=event,
            attributes={'x': 3},
        )
        campers = []

        self.assertEqual(
            calculate_computed_attributes(registration, campers),
            ({'y': 6}, []))


    def test_age(self):
        event = models.Event(
            organization=self.organization,
            name='test',
            start=datetime.datetime(2020, 6, 28, 0, 0, 0, tzinfo=timezone.utc),
            camper_computed_attributes_logic={
                'age': {
                    '/': [
                        {'-': [
                            {'var': 'event.start_yyyymmdd'},
                            {'var': 'camper.birthdate_yyyymmdd'}
                        ]},
                        10000
                    ]
                },
            }
        )
        registration = models.Registration(event=event)
        campers = [
            models.Camper(attributes={'birthdate': '2020-06-28'}),
            models.Camper(attributes={'birthdate': '2018-06-29'}),
            models.Camper(attributes={'birthdate': '2018-06-28'}),
            models.Camper(attributes={'birthdate': '2018-06-27'}),
        ]

        self.assertEqual(
            calculate_computed_attributes(registration, campers),
            ({}, [
                {'age': 0},
                {'age': 1},
                {'age': 2},
                {'age': 2},
            ]))

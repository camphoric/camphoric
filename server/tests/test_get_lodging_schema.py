import json

from django.conf import settings
from django.db import connection, reset_queries
from django.test import TestCase

from camphoric import models
from camphoric.lodging import get_lodging_schema


class TestGetLodgingSchema(TestCase):
    def setUp(self):
        self.organization = models.Organization.objects.create(name='Test Organization')
        self.event = models.Event.objects.create(
            organization=self.organization,
            name='Test Event',
            registration_schema={},
            camper_schema={},
            pricing={},
            registration_pricing_logic={},
            camper_pricing_logic={},
            confirmation_page_template='',
            confirmation_email_subject='',
            confirmation_email_template='',
            confirmation_email_from='foo@example.com'
        )
    
    def test_no_lodging(self):
        schema = get_lodging_schema(self.event)
        self.assertEqual(schema, None)

    def test_lodging_with_single_node(self):
        self.event.lodging_set.create(
            name='Test Lodging',
            children_title='',
            capacity=30,
            visible=True,
            notes=''
        )
        schema = get_lodging_schema(self.event)
        self.assertEqual(schema, {
            'title': 'Test Lodging',
            'type': 'object',
            'properties': {},
            'dependencies': {},
        })

    def test_lodging_with_node_with_children(self):
        root = self.event.lodging_set.create(
            name='Test Lodging',
            children_title='Please select a Camp',
            visible=True,
            notes=''
        )

        camp1 = self.event.lodging_set.create(
            name='Camp 1',
            parent=root,
            capacity=30,
            visible=True,
            notes=''
        )

        camp2 = self.event.lodging_set.create(
            name='Camp 2',
            parent=root,
            capacity=30,
            visible=True,
            notes=''
        )

        camp3 = self.event.lodging_set.create(
            name='Camp 3',
            parent=root,
            capacity=30,
            visible=True,
            notes=''
        )

        schema = get_lodging_schema(self.event)

        self.maxDiff = None
        self.assertEqual(schema, {
            'title': 'Test Lodging',
            'type': 'object',
            'properties': {
                'lodging_1': {
                    'title': 'Please select a Camp',
                    'enum': [
                        camp1.id,
                        camp2.id,
                        camp3.id
                    ],
                    'enumNames': [
                        camp1.name,
                        camp2.name,
                        camp3.name
                    ],
                },
            },
            'required': ['lodging_1'],
            'dependencies': {},
        })
    
    def test_lodging_with_node_with_children_and_grandchildren(self):
        root = self.event.lodging_set.create(
            name='Test Lodging',
            children_title='Please select a Camp',
            visible=True,
            notes=''
        )

        camp1 = self.event.lodging_set.create(
            name='Camp 1',
            children_title='Please select a Lodging Type',
            parent=root,
            visible=True,
            notes=''
        )

        camp2 = self.event.lodging_set.create(
            name='Camp 2',
            parent=root,
            visible=True,
            notes=''
        )

        # camp1 grandchildren (visible)

        tents_camp1 = self.event.lodging_set.create(
            name='Tents in Camp 1',
            parent=camp1,
            capacity=30,
            visible=True,
            notes=''
        )

        cabins_camp1 = self.event.lodging_set.create(
            name='Cabins in Camp 1',
            parent=camp1,
            capacity=30,
            visible=True,
            notes=''
        )

        rvs_camp1 = self.event.lodging_set.create(
            name='RVs in Camp 1',
            parent=camp1,
            capacity=30,
            visible=True,
            notes=''
        )

        # camp2 grandchildren (invisible)

        tents_camp2 = self.event.lodging_set.create(
            name='Tents in Camp 2',
            parent=camp2,
            capacity=30,
            visible=False,
            notes=''
        )

        cabins_camp2 = self.event.lodging_set.create(
            name='Cabins in Camp 2',
            parent=camp2,
            capacity=30,
            visible=False,
            notes=''
        )

        rvs_camp2 = self.event.lodging_set.create(
            name='RVs in Camp 2',
            parent=camp2,
            capacity=30,
            visible=False,
            notes=''
        )

        # make sure the lodging schema is built with one DB query
        old_debug = settings.DEBUG
        settings.DEBUG=True
        reset_queries()
        schema = get_lodging_schema(self.event)
        self.assertEqual(len(connection.queries), 1)
        settings.DEBUG=old_debug

        self.assertEqual(schema, {
            'title': 'Test Lodging',
            'type': 'object',
            'properties': {
                'lodging_1': {
                    'title': 'Please select a Camp',
                    'enum': [
                        camp1.id,
                        camp2.id
                    ],
                    'enumNames': [
                        'Camp 1',
                        'Camp 2',
                    ],
                },
            },
            'required': ['lodging_1'],
            'dependencies': {
                'lodging_1': {
                    'oneOf': [
                        {
                            'properties': {
                                'lodging_1': {
                                    'enum': [
                                        camp1.id
                                    ],
                                },
                                'lodging_2': {
                                    'title': 'Please select a Lodging Type',
                                    'enum': [
                                        tents_camp1.id,
                                        cabins_camp1.id,
                                        rvs_camp1.id,
                                    ],
                                    'enumNames': [
                                        'Tents in Camp 1',
                                        'Cabins in Camp 1',
                                        'RVs in Camp 1',
                                    ]
                                }
                            },
                            'required': ['lodging_2'],
                            'dependencies': {},
                        }
                    ]
                }
            }
        })

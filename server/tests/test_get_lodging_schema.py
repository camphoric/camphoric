from django.conf import settings
from django.db import connection, reset_queries
from django.test import TestCase

from camphoric import models
from camphoric.lodging import (
    LODGING_SCHEMA,
    get_lodging_schema,
)


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
        (schema, ui_schema) = get_lodging_schema(self.event)

        self.assertEqual(schema, None)
        self.assertEqual(ui_schema, None)

    def test_lodging_with_single_node(self):
        self.event.lodging_set.create(
            name='Test Lodging',
            children_title='',
            capacity=30,
            visible=True,
            notes=''
        )
        (schema, ui_schema) = get_lodging_schema(self.event)
        self.assertEqual(ui_schema['ui:order'], LODGING_SCHEMA['ui:order'])
        self.assertEqual(
            len(ui_schema['lodging_requested']['lodging_nodes']),
            1)

    def test_lodging_with_node_with_children(self):
        root = self.event.lodging_set.create(
            name='Test Lodging',
            children_title='Please select a Camp',
            visible=True,
            notes=''
        )

        self.event.lodging_set.create(
            name='Camp 1',
            parent=root,
            capacity=30,
            visible=True,
            notes=''
        )

        self.event.lodging_set.create(
            name='Camp 2',
            parent=root,
            capacity=30,
            visible=True,
            notes=''
        )

        self.event.lodging_set.create(
            name='Camp 3',
            parent=root,
            capacity=30,
            visible=True,
            notes=''
        )

        (schema, ui_schema) = get_lodging_schema(self.event)

        should_be = {
           "type": "object",
           "title": "Lodging",
           "properties": LODGING_SCHEMA['properties'],
           "dependencies": LODGING_SCHEMA['dependencies'],
        }

        self.assertEqual(schema, should_be)

        self.assertEqual(ui_schema['ui:order'], LODGING_SCHEMA['ui:order'])
        self.assertEqual(
            len(ui_schema['lodging_requested']['lodging_nodes']),
            4)

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

        self.event.lodging_set.create(
            name='Tents in Camp 1',
            parent=camp1,
            capacity=30,
            visible=True,
            notes=''
        )

        self.event.lodging_set.create(
            name='Cabins in Camp 1',
            parent=camp1,
            capacity=30,
            visible=True,
            notes=''
        )

        self.event.lodging_set.create(
            name='RVs in Camp 1',
            parent=camp1,
            capacity=30,
            visible=True,
            notes=''
        )

        # camp2 grandchildren (invisible)

        self.event.lodging_set.create(
            name='Tents in Camp 2',
            parent=camp2,
            capacity=30,
            visible=False,
            notes=''
        )

        self.event.lodging_set.create(
            name='Cabins in Camp 2',
            parent=camp2,
            capacity=30,
            visible=False,
            notes=''
        )

        self.event.lodging_set.create(
            name='RVs in Camp 2',
            parent=camp2,
            capacity=30,
            visible=False,
            notes=''
        )

        # make sure the lodging schema is built with one DB query
        old_debug = settings.DEBUG
        settings.DEBUG = True
        reset_queries()
        (schema, ui_schema) = get_lodging_schema(self.event)
        self.assertEqual(len(connection.queries), 1)
        settings.DEBUG = old_debug

        should_be = {
           "type": "object",
           "title": "Lodging",
           "properties": LODGING_SCHEMA['properties'],
           "dependencies": LODGING_SCHEMA['dependencies'],
        }

        self.assertEqual(schema, should_be)

        self.assertEqual(ui_schema['ui:order'], LODGING_SCHEMA['ui:order'])
        self.assertEqual(
            len(ui_schema['lodging_requested']['lodging_nodes']),
            6)

    def test_full_lodging_options(self):
        root = self.event.lodging_set.create(
            name='root')

        camp1 = self.event.lodging_set.create(
            name='camp1', visible=True, parent=root)
        camp2 = self.event.lodging_set.create(
            name='camp2', visible=True, parent=root)

        self.event.lodging_set.create(
            name='tents_camp1', visible=True, parent=camp1, capacity=2)
        cabins_camp1 = self.event.lodging_set.create(
            name='cabins_camp1', visible=True, parent=camp1, capacity=2)

        self.event.lodging_set.create(
            name='tents_camp2', visible=True, parent=camp2, capacity=2)
        cabins_camp2 = self.event.lodging_set.create(
            name='cabins_camp2', visible=True, parent=camp2, capacity=2)

        # fill all the cabins
        registration = self.event.registration_set.create(
            event=self.event,
            attributes={},
            registrant_email='registrant@example.com',
        )
        registration.campers.create(lodging=cabins_camp1)
        registration.campers.create(lodging=cabins_camp1)
        registration.campers.create(lodging=cabins_camp2)
        registration.campers.create(lodging=cabins_camp2)

        (schema, ui_schema) = get_lodging_schema(self.event)

        self.assertEqual(ui_schema['lodging_requested']['ui:field'], 'LodgingRequested')
        self.assertEqual(
            len(ui_schema['lodging_requested']['lodging_nodes']),
            6)
        # check that required attributes exist in lodging nodes
        for n in ui_schema['lodging_requested']['lodging_nodes']:
            self.assertIn('id', n)
            self.assertIn('name', n)
            self.assertIn('remaining_unreserved_capacity', n)
            self.assertIn('children_title', n)
            self.assertIn('parent', n)

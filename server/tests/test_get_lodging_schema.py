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
            confirmation_page_template="",
            confirmation_email_subject="",
            confirmation_email_template="",
            confirmation_email_from="foo@example.com"
        )
    
    def test_no_lodging(self):
        with self.assertRaises(models.Lodging.DoesNotExist):
            get_lodging_schema(self.event)
    

    def test_lodging_with_single_node(self):
        self.event.lodging_set.create(
            name="Test Lodging",
            children_title="",
            capacity=30,
            visible=True,
            notes=""
        )
        schema = get_lodging_schema(self.event)
        self.assertEqual(schema, {
            "title": "Test Lodging",
            "type": "object",
            "properties": {}
        })

    def test_lodging_with_node_with_children(self):
        root = self.event.lodging_set.create(
            name="Test Lodging",
            children_title="Please select a Camp",
            visible=True,
            notes=""
        )

        camp1 = self.event.lodging_set.create(
            name="Camp 1",
            parent=root,
            capacity=30,
            visible=True,
            notes=""
        )

        camp2 = self.event.lodging_set.create(
            name="Camp 2",
            parent=root,
            capacity=30,
            visible=True,
            notes=""
        )

        camp3 = self.event.lodging_set.create(
            name="Camp 3",
            parent=root,
            capacity=30,
            visible=True,
            notes=""
        )

        schema = get_lodging_schema(self.event)
        self.assertEqual(schema, {
            "title": "Test Lodging",
            "type": "object",
            "properties": {
                "lodging_1": {
                    "title": "Please select a Camp",
                    "enum": [
                        camp1.id,
                        camp2.id,
                        camp3.id
                    ],
                    "enumNames": [
                        camp1.name,
                        camp2.name,
                        camp3.name
                    ],
                },
            },
        })
    
    def test_lodging_with_node_with_children_and_grandchildren(self):
        root = self.event.lodging_set.create(
            name="Test Lodging",
            children_title="Please select a Camp",
            visible=True,
            notes=""
        )

        camp1 = self.event.lodging_set.create(
            name="Camp 1",
            children_title="Please select a Lodging Type",
            parent=root,
            visible=True,
            notes=""
        )

        camp2 = self.event.lodging_set.create(
            name="Camp 2",
            parent=root,
            visible=True,
            notes=""
        )

        tents_camp1 = self.event.lodging_set.create(
            name="Tents in Camp 1",
            parent=camp1,
            capacity=30,
            notes=""
        )

        cabins_camp1 = self.event.lodging_set.create(
            name="Cabins in Camp 1",
            parent=camp1,
            capacity=30,
            notes=""
        )

        rv_camp1 = self.event.lodging_set.create(
            name="RVs in Camp 1",
            parent=camp1,
            capacity=30,
            notes=""
        )

        schema = get_lodging_schema(self.event)
        self.assertEqual(schema, {
            "title": "Test Lodging",
            "type": "object",
            "properties": {
                "lodging_1": {
                    "title": "Please select a Camp",
                    "enum": [
                        camp1.id,
                        camp2.id
                    ],
                    "enumNames": [
                        camp1.name,
                        camp2.name
                    ],
                },
            },
            "dependencies": {
                "lodging_1": {
                    "oneOf": [
                        {
                            "properties": {
                                "lodging_1": {
                                    "enum": [
                                        camp1.id
                                    ],
                                },
                                "lodging_2": {
                                    "enum": [
                                        tents_camp1.id,
                                        cabins_camp1.id,
                                        rv_camp1.id
                                    ],
                                    "enumNames": [
                                        tents_camp1.name,
                                        cabins_camp1.name,
                                        rv_camp1.name
                                    ]
                                }
                            }
                        }
                    ]
                }
            }
        })

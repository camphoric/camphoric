from django.test import TestCase

from camphoric import models
from camphoric.lodging import LodgingTree


class TestLodgingTree(TestCase):
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

        self.root = self.event.lodging_set.create(
            name='root')
        self.camp1 = self.event.lodging_set.create(
            name='camp1', parent=self.root)
        self.camp2 = self.event.lodging_set.create(
            name='camp2', parent=self.root)

        self.tents_camp1 = self.event.lodging_set.create(
            name='tents_camp1', parent=self.camp1)
        self.cabins_camp1 = self.event.lodging_set.create(
            name='cabins_camp1', parent=self.camp1)

        self.tents_camp2 = self.event.lodging_set.create(
            name='tents_camp2', parent=self.camp2)
        self.cabins_camp2 = self.event.lodging_set.create(
            name='cabins_camp2', parent=self.camp2)

        self.tents_camp1_A = self.event.lodging_set.create(
            name='tents_camp1_A', parent=self.tents_camp1, capacity=10)
        self.tents_camp1_B = self.event.lodging_set.create(
            name='tents_camp1_B', parent=self.tents_camp1, capacity=20)

        self.tents_camp2_A = self.event.lodging_set.create(
            name='tents_camp2_A', parent=self.tents_camp2, capacity=30)
        self.tents_camp2_B = self.event.lodging_set.create(
            name='tents_camp2_B', parent=self.tents_camp2, capacity=40)

        self.cabins_camp1_A = self.event.lodging_set.create(
            name='cabins_camp1_A', parent=self.cabins_camp1, capacity=2, reserved=2)
        self.cabins_camp1_B = self.event.lodging_set.create(
            name='cabins_camp1_B', parent=self.cabins_camp1, capacity=4, reserved=2)

        self.cabins_camp2_A = self.event.lodging_set.create(
            name='cabins_camp2_A', parent=self.cabins_camp2, capacity=6)
        self.cabins_camp2_B = self.event.lodging_set.create(
            name='cabins_camp2_B', parent=self.cabins_camp2, capacity=8)

    def test_get(self):
        tree = LodgingTree(self.event).build()

        self.assertIsNone(tree.get(-1234))
        self.assertEqual(tree.get(self.root.id).lodging, self.root)
        self.assertEqual(tree.get(self.cabins_camp2_B.id).lodging, self.cabins_camp2_B)
    
    def test_capacity(self):
        tree = LodgingTree(self.event).build()

        self.assertEqual(tree.root.capacity, 120)
        self.assertEqual(tree.root.reserved, 4)

        self.assertEqual(tree.get(self.camp1.id).capacity, 36)
        self.assertEqual(tree.get(self.camp1.id).reserved, 4)

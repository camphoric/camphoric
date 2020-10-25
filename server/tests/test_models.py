import datetime
from django.test import TestCase
from django.utils import timezone
from camphoric import models
from freezegun import freeze_time


class OrganizationTests(TestCase):
    @freeze_time("2019-02-25 17:00:05")
    def setUp(self):
        self.organization = models.Organization.objects.create(name="Test Organization")

    def tearDown(self):
        self.organization.delete()

    def test_created_at(self):
        self.assertEqual(self.organization.name, "Test Organization")
        self.assertEqual(
            self.organization.created_at,
            datetime.datetime(2019, 2, 25, 17, 0, 5, tzinfo=timezone.utc)
        )

    @freeze_time("2019-03-26 09:52:01")
    def test_update(self):
        self.organization.name = "New Test Organization"
        self.organization.save()
        self.organization.refresh_from_db()
        self.assertEqual(self.organization.name, "New Test Organization")
        self.assertEqual(
            self.organization.updated_at,
            datetime.datetime(2019, 3, 26, 9, 52, 1, tzinfo=timezone.utc)
        )

    @freeze_time("2019-08-26 09:52:01")
    def test_soft_delete_undelete(self):
        self.assertIsNone(self.organization.deleted_at)
        self.organization.soft_delete()
        self.organization.refresh_from_db()
        self.assertEqual(
            self.organization.deleted_at,
            datetime.datetime(2019, 8, 26, 9, 52, 1, tzinfo=timezone.utc)
        )
        self.organization.soft_undelete()
        self.organization.refresh_from_db()
        self.assertIsNone(self.organization.deleted_at)


class InvitationTests(TestCase):

    def test_invitation_code(self):
        self.invitation = models.Invitation.objects.create(
            recipient_email='test@example.com',
        )
        self.assertRegex(self.invitation.invitation_code, r'^[abcdefghjkmnpqrstuvwxyz23456789]{8}$')

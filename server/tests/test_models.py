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


class LodgingTests(TestCase):

    def setUp(self):
        self.organization = models.Organization.objects.create()
        self.event = models.Event.objects.create(organization=self.organization)
        self.lodging = models.Lodging.objects.create(name="Test Lodging", event=self.event)

    def test_lodging_default_blank(self):
        self.assertEqual(self.lodging.notes, '')


class EventTests(TestCase):
    def setUp(self):
        self.organization = models.Organization.objects.create()

    def test_is_open(self):
        one_day = datetime.timedelta(days=1)
        long_ago = datetime.datetime(1979, 2, 25, tzinfo=timezone.get_current_timezone())
        far_future = datetime.datetime(2479, 2, 25, tzinfo=timezone.get_current_timezone())
        now = timezone.now()

        event = models.Event.objects.create(
                organization=self.organization,
                registration_start=None,
                registration_end=None,
            )
        self.assertEqual(event.is_open(), True, msg='when start/end is none it defaults to open')

        event = models.Event.objects.create(
                organization=self.organization,
                registration_start=long_ago,
                registration_end=far_future,
            )
        self.assertEqual(event.is_open(), True)

        event = models.Event.objects.create(
                organization=self.organization,
                registration_start=now + one_day,
                registration_end=far_future,
            )
        self.assertEqual(event.is_open(), False)

        event = models.Event.objects.create(
                organization=self.organization,
                registration_start=long_ago,
                registration_end=now - one_day,
            )
        self.assertEqual(event.is_open(), False)

        event = models.Event.objects.create(
                organization=self.organization,
                registration_start=now + one_day,
                registration_end=now - one_day,
            )
        self.assertEqual(event.is_open(), False)

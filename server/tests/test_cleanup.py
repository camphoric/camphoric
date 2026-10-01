import datetime
from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from django_tasks_db.models import DBTaskResult

from camphoric import cleanup, models

# The real queue: tasks are rows that a worker runs.
DATABASE_QUEUE = override_settings(TASKS={'default': {
    'BACKEND': 'django_tasks_db.DatabaseBackend', 'QUEUES': ['email', 'default']}})

MONTH_AGO = timezone.now() - cleanup.INCOMPLETE_REGISTRATION_MAX_AGE - datetime.timedelta(hours=1)


class CleanUpTestCase(TestCase):
    def setUp(self):
        organization = models.Organization.objects.create(name='Org')
        self.event = models.Event.objects.create(organization=organization, name='Camp')

    def registration(self, *, completed=False, changed=MONTH_AGO, campers=1):
        registration = models.Registration.objects.create(
            event=self.event, registrant_email='pat@example.com', completed=completed)
        for _ in range(campers):
            models.Camper.objects.create(registration=registration, attributes={})
        # updated_at is set on every save, so backdate it with an update.
        models.Registration.all_objects.filter(id=registration.id).update(updated_at=changed)
        return registration

    def exists(self, registration):
        return models.Registration.all_objects.filter(id=registration.id).exists()


class DeleteAbandonedRegistrationsTests(CleanUpTestCase):
    def test_an_incomplete_registration_untouched_for_a_month_goes_with_its_campers(self):
        abandoned = self.registration(campers=2)
        self.assertEqual(cleanup.delete_abandoned_registrations(), 1)
        self.assertFalse(self.exists(abandoned))
        self.assertFalse(models.Camper.all_objects.filter(registration_id=abandoned.id).exists())

    def test_a_recently_changed_incomplete_registration_stays(self):
        recent = self.registration(changed=timezone.now() - datetime.timedelta(days=29))
        self.assertEqual(cleanup.delete_abandoned_registrations(), 0)
        self.assertTrue(self.exists(recent))

    def test_a_completed_registration_stays(self):
        completed = self.registration(completed=True)
        self.assertEqual(cleanup.delete_abandoned_registrations(), 0)
        self.assertTrue(self.exists(completed))

    def test_a_registration_with_a_payment_stays_even_a_deleted_payment(self):
        paid = self.registration()
        models.Payment.objects.create(registration=paid, amount=Decimal('10'))
        refunded = self.registration()
        models.Payment.objects.create(
            registration=refunded, amount=Decimal('10')).soft_delete()
        self.assertEqual(cleanup.delete_abandoned_registrations(), 0)
        self.assertTrue(self.exists(paid))
        self.assertTrue(self.exists(refunded))

    def test_a_deleted_incomplete_registration_goes_too(self):
        deleted = self.registration()
        deleted.soft_delete()
        models.Registration.all_objects.filter(id=deleted.id).update(updated_at=MONTH_AGO)
        self.assertEqual(cleanup.delete_abandoned_registrations(), 1)
        self.assertFalse(self.exists(deleted))

    def test_its_invitation_is_kept_for_another_try(self):
        abandoned = self.registration()
        registration_type = models.RegistrationType.objects.create(
            event=self.event, name='crew', label='Crew')
        invitation = models.Invitation.objects.create(
            registration_type=registration_type, recipient_email='pat@example.com',
            registration=abandoned)
        cleanup.delete_abandoned_registrations()
        invitation.refresh_from_db()
        self.assertIsNone(invitation.registration)


class ScheduleTests(CleanUpTestCase):
    def test_the_run_is_at_ten_utc_today_or_tomorrow(self):
        utc = datetime.UTC
        self.assertEqual(cleanup.next_run(datetime.datetime(2026, 10, 1, 9, 59, tzinfo=utc)),
                         datetime.datetime(2026, 10, 1, 10, 0, tzinfo=utc))
        self.assertEqual(cleanup.next_run(datetime.datetime(2026, 10, 1, 10, 0, tzinfo=utc)),
                         datetime.datetime(2026, 10, 2, 10, 0, tzinfo=utc))
        self.assertEqual(cleanup.next_run(datetime.datetime(2026, 10, 1, 23, 0, tzinfo=utc)),
                         datetime.datetime(2026, 10, 2, 10, 0, tzinfo=utc))

    def test_without_the_database_queue_nothing_is_scheduled(self):
        self.assertFalse(cleanup.schedule_clean_up())

    @DATABASE_QUEUE
    def test_there_is_only_one_clean_up_chain(self):
        self.assertTrue(cleanup.schedule_clean_up())
        self.assertFalse(cleanup.schedule_clean_up())
        waiting = DBTaskResult.objects.get(task_path=cleanup.clean_up.module_path)
        self.assertEqual(waiting.status, 'READY')
        self.assertEqual(waiting.run_after, cleanup.next_run())

    @DATABASE_QUEUE
    def test_a_run_cleans_up_and_schedules_the_next_night(self):
        abandoned = self.registration()
        self.assertEqual(cleanup.clean_up.call(), {'deleted_registrations': 1})
        self.assertFalse(self.exists(abandoned))
        self.assertTrue(DBTaskResult.objects.filter(
            task_path=cleanup.clean_up.module_path, status='READY').exists())


class CleanUpCommandTests(CleanUpTestCase):
    def run_command(self, **options):
        out = StringIO()
        call_command('camphoric_clean_up', stdout=out, **options)
        return out.getvalue()

    def test_a_dry_run_counts_per_event_and_deletes_nothing(self):
        abandoned = self.registration()
        self.registration()
        output = self.run_command(dry_run=True)
        self.assertIn('Camp: 2', output)
        self.assertIn('2 abandoned registration(s) would be deleted.', output)
        self.assertTrue(self.exists(abandoned))

    def test_it_deletes_them(self):
        abandoned = self.registration()
        self.assertIn('Deleted 1 abandoned registration(s).', self.run_command())
        self.assertFalse(self.exists(abandoned))

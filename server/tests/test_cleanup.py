import datetime
from io import StringIO

from auditlog.models import LogEntry
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from django_tasks_db.models import DBTaskResult

from camphoric import cleanup, models

# The real queue: tasks are rows that a worker runs.
DATABASE_QUEUE = override_settings(TASKS={'default': {
    'BACKEND': 'django_tasks_db.DatabaseBackend', 'QUEUES': ['email', 'default']}})

MONTH_AGO = timezone.now() - datetime.timedelta(days=30, hours=1)


class CleanUpTestCase(TestCase):
    def setUp(self):
        organization = models.Organization.objects.create(name='Org')
        self.event = models.Event.objects.create(organization=organization, name='Camp')

    def draft(self, active=MONTH_AGO, **fields):
        return models.RegistrationDraft.objects.create(
            event=self.event, last_activity_at=active, **fields)

    def exists(self, draft):
        return models.RegistrationDraft.objects.filter(id=draft.id).exists()


class DeleteAbandonedDraftsTests(CleanUpTestCase):
    def test_drafts_with_no_activity_for_the_period_go_submitted_or_not(self):
        being_filled_in = self.draft()
        submitted = self.draft(submitted_at=MONTH_AGO)
        self.assertEqual(cleanup.delete_abandoned_drafts(), 2)
        self.assertFalse(self.exists(being_filled_in))
        self.assertFalse(self.exists(submitted))

    def test_activity_keeps_one_however_old_it_is(self):
        recent = self.draft(active=timezone.now() - datetime.timedelta(days=29),
                            created_at=MONTH_AGO)
        self.assertEqual(cleanup.delete_abandoned_drafts(), 0)
        self.assertTrue(self.exists(recent))

    @override_settings(CAMPHORIC_INCOMPLETE_RETENTION_DAYS=7)
    def test_the_retention_setting_says_how_long_they_stay(self):
        expired = self.draft(active=timezone.now() - datetime.timedelta(days=8))
        kept = self.draft(active=timezone.now() - datetime.timedelta(days=6))
        cleanup.delete_abandoned_drafts()
        self.assertFalse(self.exists(expired))
        self.assertTrue(self.exists(kept))

    def test_it_leaves_nothing_in_the_audit_log(self):
        before = LogEntry.objects.count()
        self.draft()
        cleanup.delete_abandoned_drafts()
        self.assertEqual(LogEntry.objects.count(), before)

    def test_a_registration_is_never_touched(self):
        registration = models.Registration.objects.create(
            event=self.event, registrant_email='pat@example.com')
        models.Registration.all_objects.filter(id=registration.id).update(updated_at=MONTH_AGO)
        cleanup.delete_abandoned_drafts()
        self.assertTrue(models.Registration.objects.filter(id=registration.id).exists())


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
        abandoned = self.draft()
        self.assertEqual(
            cleanup.clean_up.call(),
            {'deleted_drafts': 1, 'purged_leases': 0, 'lapsed_app_connections': 0,
             'expired_api_tokens': 0})
        self.assertFalse(self.exists(abandoned))
        self.assertTrue(DBTaskResult.objects.filter(
            task_path=cleanup.clean_up.module_path, status='READY').exists())


class CleanUpCommandTests(CleanUpTestCase):
    def run_command(self, **options):
        out = StringIO()
        call_command('camphoric_clean_up', stdout=out, **options)
        return out.getvalue()

    def test_a_dry_run_counts_per_event_and_deletes_nothing(self):
        abandoned = self.draft()
        self.draft()
        output = self.run_command(dry_run=True)
        self.assertIn('Camp: 2', output)
        self.assertIn('2 abandoned registration draft(s) would be deleted.', output)
        self.assertTrue(self.exists(abandoned))

    def test_it_deletes_them(self):
        abandoned = self.draft()
        self.assertIn('Deleted 1 abandoned registration draft(s).', self.run_command())
        self.assertFalse(self.exists(abandoned))

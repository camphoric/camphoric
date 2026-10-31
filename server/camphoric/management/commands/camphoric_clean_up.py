'''
Run the nightly clean-up now (camphoric.cleanup): delete the registration drafts
left alone for CAMPHORIC_INCOMPLETE_RETENTION_DAYS.

    manage.py camphoric_clean_up --dry-run   # list what would be deleted
    manage.py camphoric_clean_up             # delete them
'''

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import Count

from camphoric import cleanup


class Command(BaseCommand):
    help = ('Delete the registration drafts left alone for '
            f'{settings.CAMPHORIC_INCOMPLETE_RETENTION_DAYS} days, as the worker does nightly.')

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='List how many drafts each event would lose, and delete nothing')

    def handle(self, *, dry_run=False, **options):
        if dry_run:
            per_event = (cleanup.abandoned_drafts().order_by().values('event__name')
                         .annotate(count=Count('id')).order_by('event__name'))
            for row in per_event:
                self.stdout.write(f"{row['event__name']}: {row['count']}")
            total = sum(row['count'] for row in per_event)
            self.stdout.write(f'{total} abandoned registration draft(s) would be deleted.')
            return
        deleted = cleanup.delete_abandoned_drafts()
        self.stdout.write(f'Deleted {deleted} abandoned registration draft(s).')

'''
Run the nightly clean-up now (camphoric.cleanup): delete the registration drafts
and incomplete registrations left alone for CAMPHORIC_INCOMPLETE_RETENTION_DAYS.

    manage.py camphoric_clean_up --dry-run   # list what would be deleted
    manage.py camphoric_clean_up             # delete them
'''

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import Count

from camphoric import cleanup


class Command(BaseCommand):
    help = ('Delete the registration drafts and incomplete registrations left alone for '
            f'{settings.CAMPHORIC_INCOMPLETE_RETENTION_DAYS} days, as the worker does nightly.')

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='List how many drafts and registrations each event would lose, '
                 'and delete nothing')

    def handle(self, *, dry_run=False, **options):
        if dry_run:
            for abandoned, kind in ((cleanup.abandoned_drafts(), 'registration draft'),
                                    (cleanup.abandoned_registrations(), 'registration')):
                per_event = (abandoned.order_by().values('event__name')
                             .annotate(count=Count('id')).order_by('event__name'))
                for row in per_event:
                    self.stdout.write(f"{row['event__name']}: {row['count']}")
                total = sum(row['count'] for row in per_event)
                self.stdout.write(f'{total} abandoned {kind}(s) would be deleted.')
            return
        drafts = cleanup.delete_abandoned_drafts()
        self.stdout.write(f'Deleted {drafts} abandoned registration draft(s).')
        deleted = cleanup.delete_abandoned_registrations()
        self.stdout.write(f'Deleted {deleted} abandoned registration(s).')

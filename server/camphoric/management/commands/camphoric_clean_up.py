'''
Run the nightly clean-up now (camphoric.cleanup): delete the incomplete
registrations nobody has changed in a month.

    manage.py camphoric_clean_up --dry-run   # list what would be deleted
    manage.py camphoric_clean_up             # delete them
'''

from django.core.management.base import BaseCommand
from django.db.models import Count

from camphoric import cleanup


class Command(BaseCommand):
    help = ('Delete the incomplete registrations nobody has changed in '
            f'{cleanup.INCOMPLETE_REGISTRATION_MAX_AGE.days} days, as the worker does nightly.')

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='List how many registrations each event would lose, and delete nothing')

    def handle(self, *, dry_run=False, **options):
        if dry_run:
            per_event = (cleanup.abandoned_registrations()
                         .values('event__name').annotate(count=Count('id')).order_by('event__name'))
            for row in per_event:
                self.stdout.write(f"{row['event__name']}: {row['count']}")
            total = sum(row['count'] for row in per_event)
            self.stdout.write(f'{total} abandoned registration(s) would be deleted.')
            return
        deleted = cleanup.delete_abandoned_registrations()
        self.stdout.write(f'Deleted {deleted} abandoned registration(s).')

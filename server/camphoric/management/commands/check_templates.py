'''
Check events' templates render (SPEC §9.3).

    manage.py check_templates --all
    manage.py check_templates --event 4 --event 5 --strict

Prints each template's result; exits 1 if any has an error (or, with
--strict, a warning).
'''

from django.core.management.base import BaseCommand, CommandError

from camphoric import models
from camphoric.templating.checks import check_event_templates


class Command(BaseCommand):
    help = "Render or parse every template of the given events and report problems."

    def add_arguments(self, parser):
        parser.add_argument('--event', type=int, action='append', default=[],
                            help='An event id (repeatable).')
        parser.add_argument('--all', action='store_true', help='Check every event.')
        parser.add_argument('--strict', action='store_true',
                            help='Treat warnings as failures.')

    def handle(self, *args, **options):
        if options['all']:
            events = models.Event.objects.filter(deleted_at__isnull=True).order_by('id')
        elif options['event']:
            events = models.Event.objects.filter(id__in=options['event']).order_by('id')
        else:
            raise CommandError('Give --event ID (repeatable) or --all.')

        failures = 0
        for event in events:
            self.stdout.write(f'{event.name} (#{event.id})')
            for result in check_event_templates(event):
                problems = result.errors + (result.warnings if options['strict'] else [])
                status = 'FAIL' if problems else ('skip' if result.mode == 'skipped' else 'ok')
                self.stdout.write(f'  {status:4}  {result.kind} "{result.label}" ({result.mode})')
                for diagnostic in result.diagnostics:
                    where = f'line {diagnostic.line}: ' if diagnostic.line else ''
                    self.stdout.write(
                        f'          {diagnostic.severity}: {where}{diagnostic.message}')
                failures += bool(problems)

        if failures:
            raise CommandError(f'{failures} template(s) failed.')
        self.stdout.write(self.style.SUCCESS('All templates OK.'))

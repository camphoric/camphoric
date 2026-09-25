'''
Send a bulk email task (SPEC §8.9): what `POST /api/bulkemailtasks/<id>/send
?background=1` starts, so a long send doesn't tie up a web worker.

    manage.py send_bulk_email 12
'''

from django.core.management.base import BaseCommand, CommandError

from camphoric import mail, models


class Command(BaseCommand):
    help = 'Send (or resume) a bulk email task to its unsent recipients.'

    def add_arguments(self, parser):
        parser.add_argument('task_id', type=int)

    def handle(self, *args, task_id, **options):
        try:
            task = models.BulkEmailTask.objects.get(id=task_id)
        except models.BulkEmailTask.DoesNotExist:
            raise CommandError(f'No bulk email task {task_id}.')
        mail.send_bulk_email(task)
        task.refresh_from_db()
        sent = task.recipients.filter(sent_time__isnull=False).count()
        self.stdout.write(f'Task {task.id}: {sent} of {task.recipients.count()} sent.')

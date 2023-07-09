from django.core.management.base import BaseCommand
from django.conf import settings
import os


class Command(BaseCommand):
    help = "Create directories based on STATICFILES_DIRS setting"

    def handle(self, *args, **options):
        for pth in settings.STATICFILES_DIRS:
            try:
                os.makedirs(pth)
                self.stdout.write(
                    self.style.SUCCESS('Successfully created "%s"' % pth)
                )
            except Exception as e:
                self.stderr.write(
                    self.style.ERROR(str(e))
                )

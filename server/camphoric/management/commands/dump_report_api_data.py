'''
Print what the v2 client fetches to build a legacy report's variables, as the
API returns it (a temporary tool for converting data/ reports to server
variables, DR-41). `client_v2/scripts/legacy-report-outputs.mjs` builds the bundle from it
with the client's own code.

    manage.py dump_report_api_data --event 4 > report-api-data.json
'''

import json

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from rest_framework.renderers import JSONRenderer

from camphoric import models, serializers

from ._report_enrichment import enrich_event


class Command(BaseCommand):
    help = "Print the API data a legacy report's variables are built from."

    def add_arguments(self, parser):
        parser.add_argument('--event', type=int, required=True)
        parser.add_argument('--enrich', action='store_true',
                            help='Add varied data first (rolled back afterwards).')

    def handle(self, *args, event, enrich, **options):
        try:
            event_obj = models.Event.objects.get(id=event)
        except models.Event.DoesNotExist:
            raise CommandError(f'No event {event}.')
        with transaction.atomic():
            if enrich:
                enrich_event(event_obj)
            self.dump(event_obj)
            transaction.set_rollback(True)

    def dump(self, event_obj):
        event = event_obj.id

        # The same querysets and filters as the list endpoints the client calls
        # (hooks/useReportData.ts). PaymentViewSet has no registration__completed
        # filter, so the client gets every payment of the event.
        def dump(serializer, queryset):
            return serializer(queryset, many=True).data

        data = {
            'event': serializers.EventSerializer(event_obj).data,
            'registrations': dump(serializers.RegistrationSerializer,
                                  models.Registration.objects.filter(event=event, completed=True)),
            'campers': dump(serializers.CamperSerializer, models.Camper.objects.filter(
                registration__event=event, registration__completed=True)),
            'payments': dump(serializers.PaymentSerializer,
                             models.Payment.objects.filter(registration__event=event)),
            'lodgings': dump(serializers.LodgingSerializer,
                             models.Lodging.objects.filter(event=event)),
            'registrationTypes': dump(serializers.RegistrationTypeSerializer,
                                      models.RegistrationType.objects.filter(event=event)),
            'reports': dump(serializers.ReportSerializer,
                            models.Report.objects.filter(event=event)),
        }
        # Through DRF's renderer, so dates, decimals and UUIDs look as the API sends them.
        self.stdout.write(json.dumps(json.loads(JSONRenderer().render(data)), indent=1))

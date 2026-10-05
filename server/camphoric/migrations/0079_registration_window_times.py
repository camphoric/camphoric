'''
The registration window becomes date + time (issue #744; SPEC §8.3, DR-97):
`registration_start` and `registration_end` turn from dates into instants, and
each event gains a `time_zone` they're entered and shown in.

Every existing event is in San Francisco's zone. Its dates become midnight
there, not midnight UTC, so an event that closed "on Dec 13" still closes as
Dec 13 begins at camp.
'''

import datetime
import zoneinfo

import camphoric.models
from django.db import migrations, models

EXISTING_TIME_ZONE = 'America/Los_Angeles'
FIELDS = ('registration_start', 'registration_end')


def to_local_midnight(apps, schema_editor):
    '''Changing the column type made each date midnight UTC; move it to midnight at camp.'''
    Event = apps.get_model('camphoric', 'Event')
    zone = zoneinfo.ZoneInfo(EXISTING_TIME_ZONE)
    for event in Event.objects.all():
        changes = {'time_zone': EXISTING_TIME_ZONE}
        for field in FIELDS:
            value = getattr(event, field)
            if value is not None:
                day = value.astimezone(datetime.timezone.utc).date()
                changes[field] = datetime.datetime.combine(day, datetime.time(0), tzinfo=zone)
        Event.objects.filter(pk=event.pk).update(**changes)


def to_utc_midnight(apps, schema_editor):
    '''
    Back to dates: make each instant midnight UTC of its day at camp, so the
    column's cast to a date (in UTC) keeps that day.
    '''
    Event = apps.get_model('camphoric', 'Event')
    for event in Event.objects.all():
        zone = zoneinfo.ZoneInfo(event.time_zone)
        changes = {}
        for field in FIELDS:
            value = getattr(event, field)
            if value is not None:
                day = value.astimezone(zone).date()
                changes[field] = datetime.datetime.combine(
                    day, datetime.time(0), tzinfo=datetime.timezone.utc)
        if changes:
            Event.objects.filter(pk=event.pk).update(**changes)


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0078_invoice_email'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='time_zone',
            field=models.CharField(default=camphoric.models.default_time_zone, help_text="The camp's IANA time zone (e.g. America/Los_Angeles)", max_length=64),
        ),
        migrations.AlterField(
            model_name='event',
            name='registration_end',
            field=models.DateTimeField(null=True),
        ),
        migrations.AlterField(
            model_name='event',
            name='registration_start',
            field=models.DateTimeField(null=True),
        ),
        migrations.RunPython(to_local_midnight, to_utc_midnight),
    ]

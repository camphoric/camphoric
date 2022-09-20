# Generated by Django 3.2.15 on 2022-09-19 19:25

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0035_event_default_stay_length'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='camper',
            name='stay_end',
        ),
        migrations.RemoveField(
            model_name='camper',
            name='stay_start',
        ),
        migrations.AddField(
            model_name='camper',
            name='stay',
            field=models.JSONField(help_text='JSON array of dates', null=True),
        ),
    ]

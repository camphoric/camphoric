# Generated by Django 3.2.9 on 2022-01-23 00:29

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0025_auto_20220115_2230'),
    ]

    operations = [
        migrations.AddField(
            model_name='camper',
            name='lodging_shared',
            field=models.BooleanField(default=False, help_text='true if this camper is sharing a space with other camper(s)'),
        ),
        migrations.AddField(
            model_name='camper',
            name='lodging_shared_with',
            field=models.CharField(blank=True, default='', help_text='names of other campers in shared space, relevant if lodging_shared=True', max_length=255),
        ),
        migrations.AddField(
            model_name='lodging',
            name='sharing_multiplier',
            field=models.FloatField(default=1, help_text='campers with lodging_shared=True subtract this quantity from capacity'),
        ),
    ]

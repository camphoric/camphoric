# Generated by Django 4.1.4 on 2023-03-15 04:35

from django.db import migrations


def populate_completed(apps, schema_editor):
    Registration = apps.get_model('camphoric', 'Registration')
    for registration in Registration.objects.filter(payment_type__isnull=False):
        registration.completed = True
        registration.save()


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0045_registration_completed'),
    ]

    operations = [
        migrations.RunPython(populate_completed, backwards),
    ]

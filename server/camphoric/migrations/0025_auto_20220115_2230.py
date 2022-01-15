# Generated by Django 3.2.9 on 2022-01-15 22:30

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0024_auto_20211223_2251'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='registration_admin_schema',
            field=models.JSONField(default=dict, help_text='JSON schema for Registration.admin_attributes'),
        ),
        migrations.AddField(
            model_name='registration',
            name='admin_attributes',
            field=models.JSONField(default=dict, help_text='custom attributes for administrative use'),
        ),
    ]

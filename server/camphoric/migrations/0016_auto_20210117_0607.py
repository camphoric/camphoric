# Generated by Django 3.1.5 on 2021-01-17 06:07

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0015_auto_20201128_0134'),
    ]

    operations = [
        migrations.AlterField(
            model_name='registrationtype',
            name='invitation_email_template',
            field=models.TextField(blank=True, null=True),
        ),
    ]

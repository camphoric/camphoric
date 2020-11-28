# Generated by Django 3.1.2 on 2020-11-28 01:34

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0014_auto_20201025_0058'),
    ]

    operations = [
        migrations.AlterField(
            model_name='camper',
            name='attributes',
            field=models.JSONField(null=True),
        ),
        migrations.AlterField(
            model_name='deposit',
            name='attributes',
            field=models.JSONField(null=True),
        ),
        migrations.AlterField(
            model_name='event',
            name='camper_pricing_logic',
            field=models.JSONField(help_text='JsonLogic Camper-level pricing components', null=True),
        ),
        migrations.AlterField(
            model_name='event',
            name='camper_schema',
            field=models.JSONField(help_text='JSON schema for Camper.attributes', null=True),
        ),
        migrations.AlterField(
            model_name='event',
            name='confirmation_email_template',
            field=models.JSONField(default=list, help_text='JsonLogic template'),
        ),
        migrations.AlterField(
            model_name='event',
            name='confirmation_page_template',
            field=models.JSONField(default=list, help_text='JsonLogic template'),
        ),
        migrations.AlterField(
            model_name='event',
            name='deposit_schema',
            field=models.JSONField(help_text='JSON schema for Deposit.attributes', null=True),
        ),
        migrations.AlterField(
            model_name='event',
            name='payment_schema',
            field=models.JSONField(help_text='JSON schema for Payment.attributes', null=True),
        ),
        migrations.AlterField(
            model_name='event',
            name='pricing',
            field=models.JSONField(help_text='key-value object with pricing variables', null=True),
        ),
        migrations.AlterField(
            model_name='event',
            name='registration_pricing_logic',
            field=models.JSONField(help_text='JsonLogic Registration-level pricing components', null=True),
        ),
        migrations.AlterField(
            model_name='event',
            name='registration_schema',
            field=models.JSONField(help_text='JSON schema for Registration.attributes', null=True),
        ),
        migrations.AlterField(
            model_name='event',
            name='registration_ui_schema',
            field=models.JSONField(help_text='react-jsonschema-form uiSchema for registration form', null=True),
        ),
        migrations.AlterField(
            model_name='payment',
            name='attributes',
            field=models.JSONField(null=True),
        ),
        migrations.AlterField(
            model_name='registration',
            name='attributes',
            field=models.JSONField(null=True),
        ),
        migrations.AlterField(
            model_name='registration',
            name='client_reported_pricing',
            field=models.JSONField(null=True),
        ),
        migrations.AlterField(
            model_name='registration',
            name='server_pricing_results',
            field=models.JSONField(null=True),
        ),
        migrations.AlterField(
            model_name='registrationtype',
            name='invitation_email_template',
            field=models.JSONField(null=True),
        ),
    ]

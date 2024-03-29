# Generated by Django 3.2.15 on 2022-09-21 05:40

from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    def seed_lodging_requested(apps, schema_editor):
        Camper = apps.get_model("camphoric", "Camper")
        for camper in Camper.objects.all():
            camper.lodging_requested = camper.lodging
            camper.save()

    dependencies = [
        ('camphoric', '0036_auto_20220919_1925'),
    ]

    operations = [
        migrations.AddField(
            model_name='camper',
            name='lodging_requested',
            field=models.ForeignKey(help_text='original lodging at time of registration', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='lodging_requested', to='camphoric.lodging'),
        ),
        migrations.RunPython(seed_lodging_requested),
    ]

'''
A custom charge belongs to a registration, and to one of its campers or to the
registration itself (SPEC DR-168). Every existing charge is a camper's, so its
registration is its camper's.
'''

import django.db.models.deletion
from django.db import migrations, models
from django.db.models import OuterRef, Subquery


def fill_registration(apps, schema_editor):
    CustomCharge = apps.get_model('camphoric', 'CustomCharge')
    Camper = apps.get_model('camphoric', 'Camper')
    CustomCharge.objects.update(registration_id=Subquery(
        Camper.objects.filter(pk=OuterRef('camper_id')).values('registration_id')[:1]))


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0097_event_payment_types'),
    ]

    operations = [
        migrations.AddField(
            model_name='customcharge',
            name='registration',
            field=models.ForeignKey(
                null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name='custom_charges', to='camphoric.registration'),
        ),
        migrations.RunPython(fill_registration, migrations.RunPython.noop),
    ]

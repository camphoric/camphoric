'''
A custom charge's registration is required, and its camper optional: a
registration's own charge has none (SPEC DR-168). A cancellation fee names the
camper it was kept for. (After 0098 has filled every charge's registration, in
its own transaction.)
'''

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0098_registration_custom_charges'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customcharge',
            name='registration',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='custom_charges', to='camphoric.registration'),
        ),
        migrations.AlterField(
            model_name='customcharge',
            name='camper',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                to='camphoric.camper'),
        ),
        migrations.AddField(
            model_name='customcharge',
            name='cancelled_camper',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='cancellation_fees', to='camphoric.camper'),
        ),
    ]

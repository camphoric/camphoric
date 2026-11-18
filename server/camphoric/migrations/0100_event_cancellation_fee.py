'''The cancellation fee an event offers when a camper is cancelled (SPEC DR-170).'''

import camphoric.models
import django.core.serializers.json
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0099_registration_custom_charges_required'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='cancellation_fee',
            field=camphoric.models.CustomJSONField(
                blank=True, default=None, encoder=django.core.serializers.json.DjangoJSONEncoder,
                help_text='JsonLogic for the fee offered when a camper is cancelled (null: none)',
                null=True),
        ),
    ]

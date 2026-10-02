'''
Every payment now has its invoice (0076): make that required, and drop the
registration's old payment fields, whose information lives on its invoices
and payments now (SPEC DR-87, DR-92).
'''

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0076_invoices_from_payments'),
    ]

    operations = [
        migrations.AlterField(
            model_name='payment',
            name='invoice',
            field=models.ForeignKey(on_delete=django.db.models.deletion.RESTRICT, related_name='payments', to='camphoric.invoice'),
        ),
        migrations.RemoveField(
            model_name='registration',
            name='initial_payment',
        ),
        migrations.RemoveField(
            model_name='registration',
            name='payment_type',
        ),
        migrations.RemoveField(
            model_name='registration',
            name='paypal_response',
        ),
    ]

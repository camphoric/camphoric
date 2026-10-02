'''
Invoices (SPEC §9.7, DR-87): the table, and the new payment and registration
fields. Payments get their invoice in 0076; 0077 then makes it required and
drops the registration's old payment fields.
'''

import camphoric.models
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0074_promo_codes'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Invoice',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('deleted_at', models.DateTimeField(null=True)),
                ('origin', models.CharField(choices=[('registration', 'From registration'), ('payment_received', 'Payment received'), ('admin', 'Created by a registrar'), ('migrated', 'Converted')], max_length=20)),
                ('description', models.CharField(blank=True, default='', max_length=255)),
                ('amount', models.DecimalField(decimal_places=2, default=0, help_text='Toward the registration', max_digits=7)),
                ('handling', models.DecimalField(decimal_places=2, default=0, help_text='E-payment handling: adds to what is owed', max_digits=7)),
                ('payment_type', models.CharField(blank=True, choices=[('Check', 'Check'), ('PayPal', 'PayPal'), ('Card', 'Debit or Credit Card'), ('Voucher', 'Discount or Gifted Credit')], max_length=255, null=True)),
                ('token', models.CharField(default=camphoric.models.invoice_token, editable=False, max_length=64, unique=True)),
                ('due_on', models.DateField(blank=True, null=True)),
                ('memo', models.TextField(blank=True, default='', help_text='Shown to the payer')),
                ('notes', models.TextField(blank=True, default='', help_text='Internal')),
                ('pending_paypal_order_id', models.CharField(blank=True, max_length=64, null=True)),
                ('cancelled_at', models.DateTimeField(blank=True, null=True)),
                ('cancel_reason', models.TextField(blank=True, default='')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('registration', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='invoices', to='camphoric.registration')),
            ],
            options={
                'ordering': ('created_at', 'id'),
            },
        ),
        migrations.AddField(
            model_name='payment',
            name='invoice',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.RESTRICT, related_name='payments', to='camphoric.invoice'),
        ),
        migrations.RenameField(
            model_name='payment',
            old_name='paypal_order_details',
            new_name='paypal_response',
        ),
        migrations.AddField(
            model_name='payment',
            name='paypal_transaction_id',
            field=models.CharField(blank=True, max_length=64, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='payment',
            name='refund_of',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.RESTRICT, related_name='refunds', to='camphoric.payment'),
        ),
        migrations.AddField(
            model_name='registration',
            name='completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='registration',
            name='confirmation_sent_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='registration',
            name='completed',
            field=models.BooleanField(default=False, help_text='True once the registrant has pressed a payment button'),
        ),
        migrations.AlterField(
            model_name='event',
            name='epayment_handling',
            field=models.DecimalField(decimal_places=2, help_text='a percent added to each electronic payment, on the amount paid', max_digits=4, null=True),
        ),
        migrations.AlterField(
            model_name='emailmessage',
            name='kind',
            field=models.CharField(choices=[('confirmation', 'Registration confirmation'), ('confirmation_report', 'Confirmation email problem report'), ('page_report', 'Confirmation page problem report'), ('payment_report', 'PayPal problem report'), ('invitation', 'Invitation'), ('bulk', 'Group email'), ('test', 'Test email'), ('account', 'Account email')], max_length=30),
        ),
    ]

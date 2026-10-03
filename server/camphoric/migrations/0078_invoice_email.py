'''
The invoice email (SPEC §9.7, DR-95): each event gets an `invoice` email
template, as new events do, and the email kinds and template purposes gain
`invoice`.
'''

import django.db.models.deletion
from django.db import migrations, models

DEFAULT_INVOICE_SUBJECT = 'Invoice #{{ invoice.id }} for {{ event.name }}'
DEFAULT_INVOICE_BODY = (
    'Hello,\n\n'
    '{% if invoice.memo %}{{ invoice.memo }}\n\n{% endif %}'
    'Your invoice for {{ event.name }}'
    '{% if campers %} ({% for camper in campers %}{{ camper.attributes.first_name }}'
    '{{ ", " if not loop.last }}{% endfor %}){% endif %}:\n\n'
    '**{{ invoice.description or "Registration" }}: {{ invoice.amount_due | money }} due**'
    '{% if invoice.due_on %} by {{ invoice.due_on | date("%B %-d, %Y") }}{% endif %}\n\n'
    '[Pay online]({{ invoice.pay_url }})\n')


def create_invoice_templates(apps, schema_editor):
    Event = apps.get_model('camphoric', 'Event')
    EmailTemplate = apps.get_model('camphoric', 'EmailTemplate')
    for event in Event.objects.filter(invoice_template__isnull=True):
        template = EmailTemplate.objects.create(
            event=event, purpose='invoice', name='Invoice',
            subject=DEFAULT_INVOICE_SUBJECT, body=DEFAULT_INVOICE_BODY)
        Event.objects.filter(pk=event.pk).update(invoice_template=template)


def remove_invoice_templates(apps, schema_editor):
    EmailTemplate = apps.get_model('camphoric', 'EmailTemplate')
    EmailTemplate.objects.filter(purpose='invoice').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0077_payments_need_invoices'),
    ]

    operations = [
        migrations.AlterField(
            model_name='emailtemplate',
            name='purpose',
            field=models.CharField(choices=[('confirmation', 'Registration confirmation'), ('invitation', 'Invitation'), ('group', 'Group email'), ('invoice', 'Invoice')], max_length=20),
        ),
        migrations.AlterField(
            model_name='emailmessage',
            name='kind',
            field=models.CharField(choices=[('confirmation', 'Registration confirmation'), ('confirmation_report', 'Confirmation email problem report'), ('page_report', 'Confirmation page problem report'), ('payment_report', 'PayPal problem report'), ('invoice', 'Invoice'), ('invitation', 'Invitation'), ('bulk', 'Group email'), ('test', 'Test email'), ('account', 'Account email')], max_length=30),
        ),
        migrations.AddField(
            model_name='event',
            name='invoice_template',
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='camphoric.emailtemplate'),
        ),
        migrations.RunPython(create_invoice_templates, remove_invoice_templates),
    ]

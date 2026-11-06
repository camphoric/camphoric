'''
A contract version is one Markdown document, its sections the document's
headings (SPEC DR-153): each version's sections become its `body`, in order,
each a `## title` heading followed by its text, and the sections go.

A published version keeps the hash recorded when it was published, which its
agreements recorded too (none had been published when this was written).

Going back makes each version's text one privacy policy section, so the code
before this (which needs exactly one) still works and nothing is lost.
'''

from django.db import migrations, models


def sections_to_body(apps, schema_editor):
    Contract = apps.get_model('camphoric', 'Contract')
    for contract in Contract.objects.all():
        parts = []
        for section in contract.sections.order_by('order'):
            text = section.body.strip()
            parts.append(f'## {section.title.strip()}' + (f'\n\n{text}' if text else ''))
        contract.body = '\n\n'.join(parts)
        contract.save(update_fields=['body'])


def body_to_section(apps, schema_editor):
    Contract = apps.get_model('camphoric', 'Contract')
    Section = apps.get_model('camphoric', 'ContractSection')
    for contract in Contract.objects.all():
        Section.objects.create(contract=contract, order=0, kind='privacy_policy',
                               title='Privacy Policy', body=contract.body)


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0092_connected_apps'),
    ]

    operations = [
        migrations.AddField(
            model_name='contract',
            name='body',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.RunPython(sections_to_body, body_to_section),
        migrations.DeleteModel(name='ContractSection'),
    ]

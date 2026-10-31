'''
Every registration is completed now: one is made only when a payment button is
pressed, and until then it's a draft (SPEC DR-140, DR-141), so `completed` goes.
'''

from django.db import migrations
from django.db.models import Exists, OuterRef
from django.db.models.functions import Coalesce


def settle_incomplete_registrations(apps):
    '''
    What migration 0089 left incomplete. One with money on it stays, and joins the
    admin lists, where registrars can see it, with its confirmation marked as sent so
    the worker doesn't email someone about a registration from long ago. The rest,
    deleted ones and those with only a charge or override, go. Returns their ids.
    '''
    Invoice = apps.get_model('camphoric', 'Invoice')
    Payment = apps.get_model('camphoric', 'Payment')
    Registration = apps.get_model('camphoric', 'Registration')

    def has(model):
        return Exists(model._base_manager.filter(registration=OuterRef('pk')))

    # The plain manager, as a historical model's is: every row.
    incomplete = Registration._base_manager.filter(completed=False)
    incomplete.filter(has(Invoice) | has(Payment)).update(
        completed=True,
        completed_at=Coalesce('completed_at', 'updated_at'),
        confirmation_sent_at=Coalesce('confirmation_sent_at', 'updated_at'))
    ids = list(incomplete.values_list('id', flat=True))
    incomplete.delete()
    return ids


def forwards(apps, schema_editor):
    ids = settle_incomplete_registrations(apps)
    if ids:
        print(f'\n  Deleted {len(ids)} incomplete registration(s): {ids}')
    # Those deletes leave foreign key checks pending, and Postgres won't alter a
    # table while they are.
    schema_editor.execute('SET CONSTRAINTS ALL IMMEDIATE')


def backwards(apps, schema_editor):
    '''The column comes back as False: every registration left is completed.'''
    apps.get_model('camphoric', 'Registration')._base_manager.update(completed=True)


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0089_registration_draft'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.RemoveField(
            model_name='registration',
            name='completed',
        ),
    ]

'''
A registration's audit history starts when it's completed (SPEC DR-139), so this
deletes what the log already holds from before that, which can't be undone:

- everything for a registration that isn't completed,
- everything for a registration since deleted that never was completed,
- on any other, whatever came before the entry showing it completed.

A completed registration with no such entry was completed before the log began.
'''

from django.db import migrations

BATCH_SIZE = 1000


def first_completions(LogEntry, registration_type):
    '''
    By registration id, the first entry showing it completed. 0 if entries only
    show it had been, as a delete does with a registration's last values.
    '''
    entries = (LogEntry.objects
               .filter(content_type=registration_type, changes__has_key='completed')
               .order_by('id')
               .values_list('id', 'object_id', 'changes__completed'))
    completions = {}
    for entry_id, registration_id, (old, new) in entries.iterator():
        if new == 'True':
            completions.setdefault(registration_id, entry_id)
        elif old == 'True':
            completions.setdefault(registration_id, 0)
    return completions


def entries_to_delete(LogEntry, Registration, registration_type):
    completions = first_completions(LogEntry, registration_type)
    # The plain manager, so deleted registrations are included.
    registrations = dict(Registration._base_manager.values_list('id', 'completed'))
    entries = (LogEntry.objects
               .filter(additional_data__has_key='registration')
               .values_list('id', 'additional_data__registration'))
    for entry_id, registration_id in entries.iterator():
        if registration_id is None:
            continue
        completion = completions.get(registration_id)
        if registrations.get(registration_id) is False:
            yield entry_id
        elif registration_id not in registrations and completion is None:
            yield entry_id
        elif completion is not None and entry_id < completion:
            yield entry_id


def delete_entries_before_completion(apps, schema_editor):
    ContentType = apps.get_model('contenttypes', 'ContentType')
    LogEntry = apps.get_model('auditlog', 'LogEntry')
    Registration = apps.get_model('camphoric', 'Registration')
    registration_type = ContentType.objects.filter(
        app_label='camphoric', model='registration').first()
    if registration_type is None:
        return  # A new database: nothing has been logged.
    doomed = list(entries_to_delete(LogEntry, Registration, registration_type))
    for start in range(0, len(doomed), BATCH_SIZE):
        LogEntry.objects.filter(id__in=doomed[start:start + BATCH_SIZE]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('auditlog', '0017_add_actor_email'),
        ('contenttypes', '0002_remove_content_type_name'),
        ('camphoric', '0087_registration_started_with_invitation'),
    ]

    operations = [
        migrations.RunPython(delete_entries_before_completion, migrations.RunPython.noop),
    ]

'''
Camphoric permission groups (SPEC DR-50): the Admin, Registrar and Reporter
groups. Existing superusers join Admin and other staff join Registrar, so
everyone who could use the admin keeps doing so; nobody's Django access
(is_staff / is_superuser) changes.
'''

from django.conf import settings
from django.db import migrations

GROUP_NAMES = ('Admin', 'Registrar', 'Reporter')


def create_role_groups(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    app_label, model_name = settings.AUTH_USER_MODEL.split('.')
    User = apps.get_model(app_label, model_name)
    groups = {name: Group.objects.get_or_create(name=name)[0] for name in GROUP_NAMES}
    for user in User.objects.filter(is_superuser=True):
        user.groups.add(groups['Admin'])
    for user in User.objects.filter(is_staff=True, is_superuser=False):
        user.groups.add(groups['Registrar'])


def remove_role_groups(apps, schema_editor):
    apps.get_model('auth', 'Group').objects.filter(name__in=GROUP_NAMES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0068_email_unsubscribe'),
        ('auth', '0012_alter_user_first_name_max_length'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(create_role_groups, remove_role_groups),
    ]

'''
Camphoric permission groups (SPEC §6, DR-50).

Each user has one site-wide role, kept as membership in a Django group:

- Admin: everything, including users and organizations.
- Registrar: everything except users and organizations.
- Reporter: read-only.

A superuser always counts as Admin, whatever their group. Django access — whether
someone may sign in to Django's admin site (`is_staff`) or has every Django
permission (`is_superuser`) — is a separate choice (`set_django_access`); the
API never looks at `is_staff`.
'''

from django.contrib.auth.models import Group
from django.db import transaction

ADMIN = 'admin'
REGISTRAR = 'registrar'
REPORTER = 'reporter'
# Highest first: a user in several groups gets the highest.
ROLES = (ADMIN, REGISTRAR, REPORTER)
GROUP_NAMES = {ADMIN: 'Admin', REGISTRAR: 'Registrar', REPORTER: 'Reporter'}
# The roles that may change data.
WRITERS = frozenset({ADMIN, REGISTRAR})

REGULAR = 'regular'
STAFF = 'staff'
SUPERUSER = 'superuser'
DJANGO_ACCESS = (REGULAR, STAFF, SUPERUSER)

_UNSET = object()


def role_of(user):
    '''The user's role, or None (anonymous, inactive, or in no role group).'''
    if user is None or not user.is_authenticated or not user.is_active:
        return None
    if user.is_superuser:
        return ADMIN
    # Cached on the user object: a request checks it more than once.
    role = getattr(user, '_camphoric_role', _UNSET)
    if role is _UNSET:
        names = set(user.groups.values_list('name', flat=True))
        role = next((r for r in ROLES if GROUP_NAMES[r] in names), None)
        user._camphoric_role = role
    return role


def role_groups():
    '''The three role groups, created if missing (e.g. after a test flush).'''
    return {role: Group.objects.get_or_create(name=GROUP_NAMES[role])[0] for role in ROLES}


@transaction.atomic
def set_role(user, role):
    '''Put the user in exactly the role's group (or none). Django access is untouched.'''
    if role is not None and role not in ROLES:
        raise ValueError(f'Unknown role {role!r}')
    groups = role_groups()
    user.groups.remove(*groups.values())
    if role is not None:
        user.groups.add(groups[role])
    user.__dict__.pop('_camphoric_role', None)


def django_access_of(user):
    if user.is_superuser:
        return SUPERUSER
    return STAFF if user.is_staff else REGULAR


def set_django_access(user, level):
    '''Set is_staff / is_superuser for a Django access level (saves the user).'''
    if level not in DJANGO_ACCESS:
        raise ValueError(f'Unknown Django access level {level!r}')
    user.is_staff = level in (STAFF, SUPERUSER)
    user.is_superuser = level == SUPERUSER
    user.save(update_fields=['is_staff', 'is_superuser'])
    user.__dict__.pop('_camphoric_role', None)

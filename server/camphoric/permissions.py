'''
Who may use the admin API (SPEC §6, DR-50), by Camphoric permission group
(camphoric.roles). `RolePermission` is the default for every view
(REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES']); public views say `AllowAny`.
'''

from rest_framework.exceptions import NotFound
from rest_framework.permissions import SAFE_METHODS, BasePermission

from camphoric import roles


def _reads(request, view):
    '''Whether the request only reads: a safe method, or one the view lists as not writing.'''
    return request.method in SAFE_METHODS or \
        request.method in getattr(view, 'read_only_methods', ())


class RolePermission(BasePermission):
    '''
    Any role may read; Registrars and Admins may also write. A view whose POST
    only reads (a preview, a render) lists it in `read_only_methods`. Anonymous
    users get 401, signed-in users without a role 403.
    '''

    def has_permission(self, request, view):
        role = roles.role_of(request.user)
        if role is None:
            return False
        return _reads(request, view) or role in roles.WRITERS


class AdminWrites(BasePermission):
    '''Any role may read; only Admins may write (organizations).'''

    def has_permission(self, request, view):
        role = roles.role_of(request.user)
        if role is None:
            return False
        return _reads(request, view) or role == roles.ADMIN


class IsAdmin(BasePermission):
    '''
    Admins only — and hidden from everyone else: a 404, not a 401 or 403, so
    user management isn't even confirmed to exist.
    '''

    def has_permission(self, request, view):
        if roles.role_of(request.user) == roles.ADMIN:
            return True
        raise NotFound()

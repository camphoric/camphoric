'''
Who may use the admin API (SPEC §6, DR-50), by Camphoric permission group
(camphoric.roles). `RolePermission` is the default for every view
(REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES']); public views say `AllowAny`.

Someone whose password a superuser set, to be changed at their next sign-in,
is refused everything here until they change it (403, code
`password_change_required`); signing out and changing the password aren't
behind these classes.

An app using an OAuth access token is also held to the token's scope, and kept
from views that say `people_only`, before any of these (camphoric.oauth, DR-147);
a personal access token is kept from them too, and a read-only one from anything
that writes (camphoric.api_tokens, DR-159).

Someone who hasn't agreed to an organization's latest contract is refused
whatever reaches that organization (403, code `contract_agreement_required`;
camphoric.contracts, DR-145): by the ids the request names, here, and by each
record the view fetches, as it fetches it (`has_object_permission`).
'''

from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import SAFE_METHODS, BasePermission

from camphoric import accounts, contracts, roles

PASSWORD_CHANGE_REQUIRED = 'password_change_required'


def _check_password_change(request):
    if accounts.must_change_password(request.user):
        raise PermissionDenied({
            'detail': 'Choose a new password before continuing.',
            'code': PASSWORD_CHANGE_REQUIRED,
        })


def _check_access(request, view):
    '''What every role's permission checks besides the role: the password, then the contracts.'''
    _check_password_change(request)
    contracts.check_request(request, view)


def reads(request, view):
    '''Whether the request only reads: a safe method, or one the view lists as not writing.'''
    return request.method in SAFE_METHODS or \
        request.method in getattr(view, 'read_only_methods', ())


class GatedPermission(BasePermission):
    '''A permission by Camphoric role, refusing each record an unagreed contract gates.'''

    def has_object_permission(self, request, view, obj):
        if not getattr(view, 'skips_contract_gate', False):
            contracts.check_record(request, obj)
        return True


class RolePermission(GatedPermission):
    '''
    Any role may read; Registrars and Admins may also write. A view whose POST
    only reads (a preview, a render) lists it in `read_only_methods`. Anonymous
    users get 401, signed-in users without a role 403.
    '''

    def has_permission(self, request, view):
        role = roles.role_of(request.user)
        if role is None:
            return False
        _check_access(request, view)
        return reads(request, view) or role in roles.WRITERS


class WritersOnly(GatedPermission):
    '''Registrars and Admins only, even to read (change history).'''

    def has_permission(self, request, view):
        role = roles.role_of(request.user)
        if role is None:
            return False
        _check_access(request, view)
        return role in roles.WRITERS


class AdminOnly(GatedPermission):
    '''Admins only (deleting an event or an organization); 403 for other roles.'''

    def has_permission(self, request, view):
        role = roles.role_of(request.user)
        if role is None:
            return False
        _check_access(request, view)
        return role == roles.ADMIN


class AdminWrites(GatedPermission):
    '''Any role may read; only Admins may write (organizations).'''

    def has_permission(self, request, view):
        role = roles.role_of(request.user)
        if role is None:
            return False
        _check_access(request, view)
        return reads(request, view) or role == roles.ADMIN


class AnyRole(GatedPermission):
    '''Any role, for reading or writing: what's the user's own (agreeing to a contract).'''

    def has_permission(self, request, view):
        if roles.role_of(request.user) is None:
            return False
        _check_access(request, view)
        return True


class IsAdmin(BasePermission):
    '''
    Admins only — and hidden from everyone else: a 404, not a 401 or 403, so
    user management isn't even confirmed to exist.
    '''

    def has_permission(self, request, view):
        if roles.role_of(request.user) != roles.ADMIN:
            raise NotFound()
        _check_password_change(request)
        return True


class IsSuperuser(BasePermission):
    '''Superusers only (setting someone's password), hidden (404) from everyone else.'''

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.is_active and user.is_superuser):
            raise NotFound()
        _check_password_change(request)
        return True

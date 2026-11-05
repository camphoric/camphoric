'''
The pages and API of OAuth for third-party apps (camphoric.oauth, SPEC §6,
§8.10, DR-146 to DR-150).

Pages, under /o/ and rendered here (not by the admin app), so the flow needs
nothing but the server:

- /o/login/ signs a person in and returns them to the consent page.
- /o/authorize/ is the consent page: it names the app, who is signed in, and
  what the app asks for, and records the approval (`ConnectedApp`). Before it,
  the signed-in person agrees to each organization's terms they have yet to
  agree to, in turn (DR-151); declining signs them out and tells the app
  `access_denied`.
- /o/switch-account/ signs out and back in as someone else, keeping the request.
- /o/token/ and /o/revoke_token/ are the toolkit's, throttled per address.

API:

- /api/user/apps: the signed-in user's connected apps; DELETE one to disconnect it.
- /api/users/<id>/apps (camphoric.views.UserViewSet): an Admin's view of a user's.
- /api/applications/: the registered apps, for Admins.
'''

import functools
import hashlib
from urllib.parse import parse_qs, urlencode, urlparse

from auditlog.models import LogEntry

from django.contrib.auth import logout
from django.contrib.auth.views import LoginView
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Count
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.urls import path
from django.utils.decorators import method_decorator
from django.utils.http import url_has_allowed_host_and_scheme
from django.views import View
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST
from oauth2_provider.exceptions import OAuthToolkitError
from oauth2_provider.generators import generate_client_secret
from oauth2_provider.models import AccessToken, Application, RefreshToken
from oauth2_provider.views import AuthorizationView, RevokeTokenView, TokenView
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from camphoric import accounts, contracts, models, oauth, roles
from camphoric.permissions import AnyRole, IsAdmin
from camphoric.serializers import ModelSerializer
from camphoric.throttles import throttle_login, throttle_oauth_token

AUTHORIZE_PATH = '/o/authorize/'
LOGIN_PATH = '/o/login/'


# Pages -------------------------------------------------------------------------------------

def consent_url(next_url):
    '''`next_url` if it's the consent page on this server, else None.'''
    if next_url and next_url.startswith(AUTHORIZE_PATH):
        return next_url
    return None


class OAuthLoginView(LoginView):
    '''
    Sign in to approve an app, then back to the consent page. It goes nowhere
    else: a `next` that isn't the consent page goes to the admin instead. The
    sign-in throttles apply (camphoric.throttles), and the session is the
    admin's too.
    '''
    template_name = 'camphoric/oauth/login.html'
    redirect_authenticated_user = True

    def get_redirect_url(self):
        return consent_url(super().get_redirect_url()) or ''

    def get_default_redirect_url(self):
        return '/admin'


def refusal(user):
    '''Why the signed-in user can't approve apps, or None if they can.'''
    if roles.role_of(user) is None:
        return ('Your account has no Camphoric permission group, so it can\'t connect apps. '
                'Ask an administrator to give it one.')
    if accounts.must_change_password(user):
        return 'Choose a new password in Camphoric before connecting an app.'
    return None


ROLE_NAMES = {roles.ADMIN: 'Admin', roles.REGISTRAR: 'Registrar', roles.REPORTER: 'Reporter'}

# How many organizations' terms the person has agreed to on the way to the
# consent page, for "2 of 3"; forgotten once the consent page shows.
TERMS_AGREED = 'camphoric_oauth_terms_agreed'


class AuthorizeView(AuthorizationView):
    '''
    The consent page (the toolkit's authorization endpoint). Someone signed out
    is sent to /o/login/ first. It's refused to anyone who couldn't use the app's
    access: no permission group, or a password to change. Then, while the person
    has organizations' terms to agree to, it asks for each in turn instead
    (`ask_to_agree`), and issues no code. Approving records the connection, with
    the scopes approved.
    '''
    template_name = 'camphoric/oauth/authorize.html'
    login_url = LOGIN_PATH

    def dispatch(self, request, *args, **kwargs):
        if 'approval_prompt' in request.GET:
            # The toolkit lets the request choose to skip the consent page
            # (`approval_prompt=auto`); here it's always shown (DR-150).
            request.GET = request.GET.copy()
            del request.GET['approval_prompt']
        if request.user.is_authenticated:
            problem = refusal(request.user)
            if problem:
                return render(request, 'camphoric/oauth/message.html', {
                    'title': 'You can\'t connect apps', 'message': problem,
                    'user': request.user}, status=403)
            if contracts.pending_organization_ids(request.user):
                return self.ask_to_agree(request)
            request.session.pop(TERMS_AGREED, None)
        return super().dispatch(request, *args, **kwargs)

    def ask_to_agree(self, request):
        '''
        The terms of the first organization the person has yet to agree to (in
        the order whoami lists them, DR-151), on the consent page's URL, so the
        app's request is kept. Agreeing records it as the admin client does
        (DR-145) and comes back here, for the next or, after the last, the
        consent page. Declining signs out and sends the app `access_denied`. Any
        other post (the consent form, sent while terms are pending) comes back
        here too: no code is issued until nothing is pending.
        '''
        decision = request.POST.get('terms') if request.method == 'POST' else None
        if request.method == 'POST' and decision not in ('agree', 'decline'):
            return HttpResponseRedirect(request.get_full_path())
        self.oauth2_data = {}
        try:
            scopes, credentials = self.validate_authorization_request(request)
        except OAuthToolkitError as error:
            return self.error_response(error, application=None)
        application = Application.objects.get(client_id=credentials['client_id'])

        error = None
        if decision == 'decline':
            logout(request)
            try:
                self.create_authorization_response(
                    request=request, scopes=' '.join(scopes), credentials=credentials,
                    allow=False)
            except OAuthToolkitError as denied:
                return self.error_response(denied, application)
        if decision == 'agree':
            error = self.agree(request)
            if error is None:
                request.session[TERMS_AGREED] = request.session.get(TERMS_AGREED, 0) + 1
                return HttpResponseRedirect(request.get_full_path())

        pending = contracts.pending_organization_ids(request.user)
        if not pending:
            # Agreed meanwhile (in another tab): on to the consent page.
            return HttpResponseRedirect(request.get_full_path())
        contract = contracts.latest_contract(pending[0])
        agreed = request.session.get(TERMS_AGREED, 0)
        return render(request, 'camphoric/oauth/terms.html', {
            'application': application,
            'user': request.user,
            'role_name': ROLE_NAMES.get(roles.role_of(request.user), ''),
            'switch_next': request.get_full_path(),
            'contract': contract,
            'organization_name': contract.organization.name,
            'sections': [{'title': section.title, 'html': contracts.section_html(section.body)}
                         for section in contract.sections.all()],
            'privacy_policy_path': f'/organizations/{contract.organization_id}/privacy-policy',
            'position': agreed + 1,
            'total': agreed + len(pending),
            'assent_text': contracts.ASSENT_TEXT,
            'error': error,
        }, status=409 if error else 200)

    @staticmethod
    def agree(request):
        '''Record the agreement posted; the reason it can't be, or None once it is.'''
        organization_id = request.POST.get('organization', '')
        organization = models.Organization.objects.filter(
            pk=int(organization_id)).first() if organization_id.isdigit() else None
        if organization is None:
            return 'These terms have changed since you opened them. Read them again, then agree.'
        try:
            contracts.agree(request, organization, request.POST.get('contract_id'),
                            request.POST.get('content_sha256'), contracts.ASSENT_TEXT)
        except contracts.ContractError as problem:
            return str(problem)
        return None

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        role = roles.role_of(self.request.user)
        scopes = context.get('scopes') or []
        context.update({
            'role_name': ROLE_NAMES.get(role, ''),
            # A Reporter can't change anything, so an app acting for them can't either.
            'write_limited_by_role': 'write' in scopes and role not in roles.WRITERS,
            'switch_next': self.request.get_full_path(),
        })
        return context

    def form_valid(self, form):
        response = super().form_valid(form)
        # The toolkit redirects with a code when it grants the request, and with an
        # error (or renders one) when it doesn't.
        # The code issued is the last: a registered redirect URI may carry its own.
        code = parse_qs(urlparse(response.get('Location', '')).query).get('code')
        if form.cleaned_data.get('allow') and response.status_code == 302 and code:
            application = Application.objects.get(client_id=form.cleaned_data['client_id'])
            oauth.connect(self.request.user, application,
                          ' '.join(oauth.scope_names(form.cleaned_data.get('scope'))), code[-1])
        return response


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(require_POST, name='dispatch')
class SwitchAccountView(View):
    '''Sign out, then sign in as someone else and return to the consent page.'''

    def post(self, request):
        next_url = request.POST.get('next', '')
        if not url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}):
            next_url = ''
        logout(request)
        query = {'next': consent_url(next_url)} if consent_url(next_url) else {}
        return HttpResponseRedirect(LOGIN_PATH + (f'?{urlencode(query)}' if query else ''))


def token_pair(request):
    '''The (user id, app id) of the token a token or revocation request names, or None.'''
    raw = request.POST.get('refresh_token') or request.POST.get('token')
    if not raw:
        return None
    checksum = hashlib.sha256(raw.encode('utf-8')).hexdigest()
    for model in (RefreshToken, AccessToken):
        pair = model.objects.filter(token_checksum=checksum).values_list(
            'user_id', 'application_id').first()
        if pair and pair[0] is not None:
            return pair
    return None


def forgets_lapsed_connections(view):
    '''
    The toolkit's token or revocation endpoint, then: when the token it was given
    leaves its connection with nothing that works — given back, or a replaced
    refresh token reused (DR-148) — the connection goes at once.
    '''
    @functools.wraps(view)
    def forgetting(request, *args, **kwargs):
        pair = token_pair(request) if request.method == 'POST' else None
        response = view(request, *args, **kwargs)
        if pair:
            oauth.forget_if_lapsed(*pair)
        return response
    return forgetting


urlpatterns = [
    path('login/', throttle_login(OAuthLoginView.as_view()), name='login'),
    path('switch-account/', SwitchAccountView.as_view(), name='switch-account'),
    path('authorize/', AuthorizeView.as_view(), name='authorize'),
    path('token/', throttle_oauth_token(forgets_lapsed_connections(TokenView.as_view())),
         name='token'),
    path('revoke_token/', throttle_oauth_token(
        forgets_lapsed_connections(RevokeTokenView.as_view())), name='revoke-token'),
]


# API ---------------------------------------------------------------------------------------

def person(user):
    return {'id': user.id, 'username': user.username,
            'name': user.get_full_name() or user.username}


class ConnectedAppSerializer(ModelSerializer):
    '''An app a user approved: which, for what, when, and when it was last used.'''
    application = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()
    scopes = serializers.SerializerMethodField()

    class Meta:
        model = models.ConnectedApp
        fields = ['id', 'application', 'user', 'scopes', 'approved_at', 'last_used_at']

    def get_application(self, connection):
        return {'id': connection.application_id, 'name': connection.application.name}

    def get_user(self, connection):
        return person(connection.user)

    def get_scopes(self, connection):
        return oauth.scope_names(connection.scope)


def connected_apps(**filters):
    return (models.ConnectedApp.objects.filter(**filters)
            .select_related('application', 'user').order_by('application__name', 'id'))


def disconnect(user, application_id):
    '''204 once the app's access for the user has ended; 404 if it wasn't connected.'''
    application = Application.objects.filter(pk=application_id).first()
    if application is None or not oauth.revoke(user, application):
        raise NotFound('That app isn\'t connected to this account.')
    return Response(status=status.HTTP_204_NO_CONTENT)


class MyConnectedAppsView(APIView):
    '''GET /api/user/apps: the apps you've approved (DR-149).'''
    permission_classes = [AnyRole]
    refuses_apps = True

    def get(self, request):
        return Response(ConnectedAppSerializer(
            connected_apps(user=request.user), many=True).data)


class MyConnectedAppView(APIView):
    '''DELETE /api/user/apps/<application_id> → 204: disconnect an app, ending its access.'''
    permission_classes = [AnyRole]
    refuses_apps = True

    def delete(self, request, application_id):
        return disconnect(request.user, application_id)


class ApplicationSerializer(ModelSerializer):
    '''
    A registered app: its name and redirect URIs (a list; each matched exactly).
    The client id is made for it; the secret is shown once, when it's made
    (`client_secret` in the answer to creating the app or asking for a new
    secret) and is stored only hashed.
    '''
    redirect_uris = serializers.ListField(
        child=serializers.CharField(max_length=2000), allow_empty=False)
    connected_users = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = ['id', 'name', 'client_id', 'redirect_uris', 'created', 'updated',
                  'connected_users']
        read_only_fields = ['client_id', 'created', 'updated']
        extra_kwargs = {'name': {'required': True, 'allow_blank': False}}

    def get_connected_users(self, application):
        counted = getattr(application, 'connected_users', None)
        return application.connections.count() if counted is None else counted

    def to_representation(self, application):
        data = super().to_representation(application)
        data['redirect_uris'] = application.redirect_uris.split()
        return data

    def to_internal_value(self, data):
        values = super().to_internal_value(data)
        if 'redirect_uris' in values:
            uris = [uri.strip() for uri in values['redirect_uris']]
            if any(not uri or any(c.isspace() for c in uri) for uri in uris):
                raise ValidationError({'redirect_uris': ['A redirect URI can\'t contain spaces.']})
            values['redirect_uris'] = ' '.join(dict.fromkeys(uris))
        return values

    def validate(self, attrs):
        candidate = Application(
            name=attrs.get('name', getattr(self.instance, 'name', '')),
            redirect_uris=attrs.get(
                'redirect_uris', getattr(self.instance, 'redirect_uris', '')),
            client_type=Application.CLIENT_CONFIDENTIAL,
            authorization_grant_type=Application.GRANT_AUTHORIZATION_CODE,
        )
        try:
            candidate.clean()
        except DjangoValidationError as error:
            raise ValidationError(error.message_dict)
        return attrs


class ApplicationViewSet(ModelViewSet):
    '''
    /api/applications/: the apps registered to use OAuth, for Admins only (a 404
    for anyone else, as for users; DR-146). Each is a confidential client using
    the authorization code grant with PKCE. Creating one, or POST
    `{id}/new-secret`, answers with its secret, once. Deleting one ends every
    user's access through it. GET `{id}/connections` lists who approved it.
    '''
    serializer_class = ApplicationSerializer
    permission_classes = [IsAdmin]
    refuses_apps = True
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return Application.objects.annotate(
            connected_users=Count('connections', distinct=True)).order_by('name', 'id')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        secret = generate_client_secret()
        application = serializer.save(
            client_type=Application.CLIENT_CONFIDENTIAL,
            authorization_grant_type=Application.GRANT_AUTHORIZATION_CODE,
            client_secret=secret, hash_client_secret=True, skip_authorization=False)
        data = self.get_serializer(application).data
        return Response({**data, 'client_secret': secret}, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def perform_destroy(self, application):
        # Each connection on its own, so the audit log records each (camphoric.audit).
        for connection in application.connections.all():
            connection.delete()
        application.delete()

    @action(detail=True, methods=['post'], url_path='new-secret')
    def new_secret(self, request, pk=None):
        '''
        A new secret for the app → `{client_secret}`; the old one stops working.
        The app keeps its connections, but needs the new secret to get tokens.
        '''
        application = self.get_object()
        secret = generate_client_secret()
        application.client_secret = secret
        application.save(update_fields=['client_secret', 'updated'])
        # The secret is never logged; that it was replaced is (camphoric.audit).
        LogEntry.objects.log_create(
            application, force_log=True, action=LogEntry.Action.UPDATE,
            changes={'client_secret': ['(hidden)', '(replaced)']})
        return Response({'client_secret': secret})

    @action(detail=True, methods=['get'])
    def connections(self, request, pk=None):
        '''Who approved the app, by name.'''
        application = self.get_object()
        return Response(ConnectedAppSerializer(
            connected_apps(application=application).order_by('user__username', 'id'),
            many=True).data)

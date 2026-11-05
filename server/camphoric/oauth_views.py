'''
OAuth for third-party apps: its endpoints and API (camphoric.oauth, SPEC §6,
§8.10, DR-146 to DR-152).

Under /o/:

- /o/authorize/ is the authorization endpoint apps send people to. It's a page
  of the client (DR-152), which the server answers with the client app; the
  page signs the person in if need be, asks for every organization's terms they
  have yet to agree to (DR-151), and shows the consent screen, through
  /api/oauth/authorize (`AuthorizationRequestView`).
- /o/token/ and /o/revoke_token/ are the toolkit's, throttled per address.

API:

- /api/oauth/authorize: what the app's request asks for, and approving or
  denying it.
- /api/user/apps: the signed-in user's connected apps; DELETE one to disconnect it.
- /api/users/<id>/apps (camphoric.views.UserViewSet): an Admin's view of a user's.
- /api/applications/: the registered apps, for Admins.
'''

import functools
import hashlib
from urllib.parse import parse_qs, urlparse

from auditlog.models import LogEntry

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Count
from django.urls import path
from oauth2_provider.exceptions import FatalClientError, OAuthToolkitError
from oauth2_provider.generators import generate_client_secret
from oauth2_provider.models import AccessToken, Application, RefreshToken
from oauth2_provider.scopes import get_scopes_backend
from oauth2_provider.views import RevokeTokenView, TokenView
from oauth2_provider.views.mixins import OAuthLibMixin
from rest_framework import serializers, status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from camphoric import accounts, contracts, models, oauth, roles
from camphoric.permissions import AnyRole, IsAdmin
from camphoric.serializers import ModelSerializer
from camphoric.throttles import throttle_oauth_token
from frontend_bootstrap.views import FrontendBootstrapView

CANNOT_CONNECT_APPS = 'cannot_connect_apps'


# The authorization request --------------------------------------------------------------

def refusal(user):
    '''Why the signed-in user can't approve apps, or None if they can.'''
    if roles.role_of(user) is None:
        return ('Your account has no Camphoric permission group, so it can\'t connect apps. '
                'Ask an administrator to give it one.')
    if accounts.must_change_password(user):
        return 'Choose a new password in Camphoric before connecting an app.'
    return None


class RequestRefused(Exception):
    '''The app's request can't be approved: where to send the person, or what to show them.'''

    def __init__(self, error):
        super().__init__()
        self.error = error


class AuthorizationRequestView(OAuthLibMixin, APIView):
    '''
    /api/oauth/authorize?<the app's authorization request, as sent to /o/authorize/>,
    for the consent page (DR-152). Signed-in people only, by their session (403
    otherwise, an app's or a script's token included), and only those who could use
    the app's access: 403 `cannot_connect_apps`, with why, for no permission group or
    a password to change.

    GET → `{application: {id, name}, scopes: [{name, description}],
    write_limited_by_role}`: what the app asks for. The consent page is shown every
    time: nothing here approves on its own (DR-150).

    POST `{allow}` → `{redirect_to}`: where to send the person — back to the app with
    a code once allowed, recording the connection, or with `error=access_denied`.
    Allowing waits for every organization's terms (403 `contract_agreement_required`,
    DR-151); denying doesn't.

    A request that can't be approved answers 400 `{error, description, redirect_to}`:
    with `redirect_to`, the app is told (the person is sent there); with it null,
    the request can't be trusted to name where to go, and the page says so.
    '''
    # A person at the consent screen, signed in to Camphoric: never an app's token, nor a
    # script's, which could otherwise approve an app with no one seeing the screen (DR-150).
    authentication_classes = [SessionAuthentication]
    permission_classes = [AnyRole]
    refuses_apps = True
    skips_contract_gate = True

    def check_permissions(self, request):
        # Saying why, where AnyRole would refuse with less: no group, a password to change.
        problem = refusal(request.user) if request.user.is_authenticated else None
        if problem:
            raise PermissionDenied({'detail': problem, 'code': CANNOT_CONNECT_APPS})
        super().check_permissions(request)

    def handle_exception(self, exc):
        if isinstance(exc, RequestRefused):
            redirect, response = self.error_response(exc.error)
            error = response['error']
            return Response({
                'error': error.error,
                'description': error.description or '',
                'redirect_to': response['url'] if redirect else None,
            }, status=status.HTTP_400_BAD_REQUEST)
        return super().handle_exception(exc)

    def validated(self, request):
        '''The app's request, checked as the toolkit checks it: (scopes, credentials, app).'''
        try:
            scopes, credentials = self.validate_authorization_request(request._request)
        except OAuthToolkitError as error:
            raise RequestRefused(error)
        return scopes, credentials, Application.objects.get(client_id=credentials['client_id'])

    def get(self, request):
        scopes, _credentials, application = self.validated(request)
        role = roles.role_of(request.user)
        descriptions = get_scopes_backend().get_all_scopes()
        names = oauth.scope_names(' '.join(scopes))
        return Response({
            'application': {'id': application.pk, 'name': application.name},
            'scopes': [{'name': name, 'description': descriptions[name]} for name in names],
            # A Reporter can't change anything, so an app acting for them can't either.
            'write_limited_by_role': 'write' in names and role not in roles.WRITERS,
        })

    def post(self, request):
        allow = isinstance(request.data, dict) and request.data.get('allow') is True
        scopes, credentials, application = self.validated(request)
        if allow:
            pending = contracts.pending_organization_ids(request.user)
            if pending:
                raise contracts.ContractAgreementRequired(pending[0])
        try:
            uri, _headers, _body, _status = self.create_authorization_response(
                request=request._request, scopes=' '.join(scopes), credentials=credentials,
                allow=allow)
        except OAuthToolkitError as error:
            if allow or isinstance(error, FatalClientError):
                raise RequestRefused(error)
            # Denied: back to the app with `access_denied`.
            return Response({'redirect_to': self.error_response(error)[1]['url']})
        # The code issued is the last: a registered redirect URI may carry its own.
        code = parse_qs(urlparse(uri).query).get('code')
        if code:
            oauth.connect(request.user, application,
                          ' '.join(oauth.scope_names(' '.join(scopes))), code[-1])
        return Response({'redirect_to': uri})


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
    # A page of the client (DR-152), which asks /api/oauth/authorize about the request.
    path('authorize/', FrontendBootstrapView.as_view(), name='authorize'),
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

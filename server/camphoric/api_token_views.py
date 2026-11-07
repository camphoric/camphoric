'''
Personal access tokens: their API (camphoric.api_tokens, SPEC §6, §8.10,
DR-157 to DR-159).

- /api/user/tokens: the signed-in user's tokens; POST makes one (its token is
  in that answer only), DELETE /api/user/tokens/<id> revokes one. For a person
  signed in to Camphoric: no token or app may make or revoke tokens this way.
- /api/user/tokens/current: DELETE revokes the token the request was made with,
  so a script can end its own when it's done (a read-only one too).
- /api/users/<id>/tokens (camphoric.views.UserViewSet): an Admin's view of a
  user's, and revoking one.
'''

from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from camphoric import api_tokens, models
from camphoric.permissions import AnyRole


class ApiTokenSerializer(serializers.ModelSerializer):
    '''
    A token as it's listed: never the token itself, which only the answer to
    making it carries (`token`). `expires_at` null: it never expires.
    '''

    class Meta:
        model = models.ApiToken
        fields = ['id', 'name', 'prefix', 'read_only', 'created_at', 'expires_at',
                  'last_used_at', 'created_via']
        read_only_fields = fields


class NewApiTokenSerializer(serializers.Serializer):
    '''
    `{name, expires_at, read_only?}`. `expires_at` must be given: a time, or
    null for never, so a token never lasts for good unless that was chosen.
    '''
    name = serializers.CharField(max_length=100, allow_blank=False, trim_whitespace=True)
    expires_at = serializers.DateTimeField(allow_null=True)
    read_only = serializers.BooleanField(default=False)

    def validate_expires_at(self, value):
        try:
            api_tokens.check_expiry(value)
        except api_tokens.TokenError as error:
            raise ValidationError(str(error))
        return value


def tokens_of(user):
    return api_tokens.live(models.ApiToken.objects.filter(user=user))


def revoke_one(user, token_id):
    '''
    204 once the user's token is revoked; 404 if they have no such token. One
    that has expired but isn't cleaned up yet can be revoked too.
    '''
    token = models.ApiToken.objects.filter(user=user, pk=token_id).first()
    if token is None:
        raise NotFound('There\'s no such token on this account.')
    api_tokens.revoke(token)
    return Response(status=status.HTTP_204_NO_CONTENT)


class MyApiTokensView(APIView):
    '''
    GET /api/user/tokens: your tokens, newest first. POST `{name, expires_at,
    read_only?}` → 201, the new token with `token`, shown only this once.
    '''
    permission_classes = [AnyRole]
    people_only = True
    # A user's own tokens aren't any organization's (DR-145).
    skips_contract_gate = True

    def get(self, request):
        return Response(ApiTokenSerializer(tokens_of(request.user), many=True).data)

    def post(self, request):
        serializer = NewApiTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            token, key = api_tokens.issue(request.user, **serializer.validated_data)
        except api_tokens.TokenError as error:
            raise ValidationError({'expires_at': [str(error)]})
        return Response({**ApiTokenSerializer(token).data, 'token': key},
                        status=status.HTTP_201_CREATED)


class MyApiTokenView(APIView):
    '''DELETE /api/user/tokens/<id> → 204: revoke one of your tokens.'''
    permission_classes = [AnyRole]
    people_only = True
    skips_contract_gate = True

    def delete(self, request, token_id):
        return revoke_one(request.user, token_id)


class CurrentApiTokenView(APIView):
    '''
    DELETE /api/user/tokens/current → 204: revoke the token this request was
    made with (a script finishing a run); 400 when it wasn't made with one.
    '''
    # Any signed-in user, whatever their group: it only ends their own access.
    permission_classes = [IsAuthenticated]
    allows_read_only_tokens = True

    def delete(self, request):
        token = request.auth
        if not isinstance(token, models.ApiToken):
            raise ValidationError({'detail': 'This request wasn\'t made with an API token.'})
        api_tokens.revoke(token)
        return Response(status=status.HTTP_204_NO_CONTENT)

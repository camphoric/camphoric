'''
An organization's email to past campers (SPEC §5, §8.12; DR-182). Any role
reads, and works out who an email reaches; Registrars and Admins write, send,
test and unsubscribe (the default RolePermission).

- `/api/organization-emails/` (`?organization=`): the emails, with `send`,
  `test` and `duplicate`.
- `/api/organization-unsubscribes/` (`?organization=`): who left them.
- `organizations/<id>/multi-event/email/recipients` and `…/recipient-fields`.
'''

from dataclasses import asdict

from django.db.models.functions import Lower
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.serializers import ValidationError
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView

from camphoric import contracts, models, serializers
from camphoric.multi_event import email
from camphoric.multi_event.views import OrganizationMixin
from camphoric.templating.urls import public_base
from camphoric.views import PlannedDeleteMixin, VersionCheckMixin


def _body(request):
    return request.data if isinstance(request.data, dict) else {}


class OrganizationEmailViewSet(VersionCheckMixin, PlannedDeleteMixin, ModelViewSet):
    queryset = models.OrganizationEmail.objects.order_by(Lower('name'), 'id')
    serializer_class = serializers.OrganizationEmailSerializer
    filterset_fields = ['organization']

    def _account(self, request, data, organization_email):
        if 'account' not in data:
            return email.SAVED
        if not data['account']:
            return None  # the server's default mailer
        account = get_object_or_404(models.EmailAccount, id=data['account'])
        contracts.check_record(request, account)
        if account.organization_id != organization_email.organization_id:
            raise ValidationError({'account': 'Choose one of the organization’s email accounts.'})
        return account

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        copy = self.get_object()
        copy.pk = None
        copy.name = f'{copy.name} (copy)'
        copy.save()
        return Response(self.get_serializer(copy).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        '''
        Send to the reviewed people: `{recipient_keys, account?, from_email?,
        reply_to?, skip_already_sent?, send_at?}` → 202 with the batch.
        '''
        organization_email = self.get_object()
        data = _body(request)
        send_at = None
        if data.get('send_at'):
            send_at = parse_datetime(str(data['send_at']))
            if send_at is None:
                raise ValidationError({'send_at': 'Give a date and time (ISO 8601).'})
        try:
            batch = email.create_batch(
                organization_email, recipient_keys=data.get('recipient_keys') or [],
                account=self._account(request, data, organization_email),
                from_email=data.get('from_email') or '',
                reply_to=(data.get('reply_to') or '') if 'reply_to' in data else email.SAVED,
                skip_already_sent=data.get('skip_already_sent', True) is not False,
                send_at=send_at, created_by=request.user, link_base=public_base(request))
        except email.EmailError as error:
            return Response({'detail': str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializers.EmailBatchSerializer(batch).data,
                        status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        '''
        Queue one copy, marked [Test], rendered for a person (`recipient_key`,
        else the first), to `to` (default: you). Unsaved `subject`, `body` and
        `filter` may be given.
        '''
        organization_email = self.get_object()
        data = _body(request)
        to = data.get('to') or request.user.email
        if not to:
            raise ValidationError({'to': 'This field is required.'})
        try:
            message, rendered, chosen = email.send_test(
                organization_email, to=to, recipient_key=data.get('recipient_key'),
                subject=data.get('subject'), body=data.get('body'),
                filter_=data.get('filter'), created_by=request.user)
        except email.EmailError as error:
            return Response({'detail': str(error)}, status=status.HTTP_400_BAD_REQUEST)
        if message is None:
            diagnostics = [d.as_dict() for d in (rendered.diagnostics if rendered else [])]
            return Response({'detail': 'The email has problems; the test was not sent.',
                             'diagnostics': diagnostics}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'message': serializers.EmailMessageDetailSerializer(message).data,
            'rendered_for': asdict(chosen),
            'diagnostics': [d.as_dict() for d in rendered.diagnostics],
        }, status=status.HTTP_202_ACCEPTED)


class OrganizationUnsubscribeViewSet(VersionCheckMixin, PlannedDeleteMixin, ModelViewSet):
    '''
    The addresses that left an organization's email to past campers; an
    organizer can add one (someone who asked by reply) or remove one.
    '''
    queryset = models.OrganizationUnsubscribe.objects.select_related('created_by').order_by(
        '-created_at', '-id')
    serializer_class = serializers.OrganizationUnsubscribeSerializer
    filterset_fields = ['organization']
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def perform_create(self, serializer):
        serializer.save(source=models.EmailUnsubscribeSource.ADMIN, created_by=self.request.user)


class RecipientsView(OrganizationMixin, APIView):
    '''
    POST `{filter, email?}`: who the rules reach (saved or not) →
    `{recipients, skipped, diagnostics}`, as group email's, each recipient with
    `already_sent` against `email`.
    '''
    read_only_methods = ('POST',)

    def post(self, request, organization_id):
        organization = self.organization()
        data = _body(request)
        resolution, _ = email.resolve(organization, data.get('filter'))
        result = resolution.as_dict()
        sent = email.sent_to(data['email']) if isinstance(data.get('email'), int) else None
        for candidate, recipient in zip(resolution.recipients, result['recipients']):
            recipient['already_sent'] = sent is not None and candidate in sent
        return Response(result)


class RecipientFieldsView(OrganizationMixin, APIView):
    '''GET: the fields people can be chosen by, for the rule builder.'''

    def get(self, request, organization_id):
        return Response(email.recipient_fields(self.organization()))

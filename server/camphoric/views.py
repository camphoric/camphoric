from dataclasses import asdict
import datetime
from functools import partial
import logging
import traceback

from dateutil.relativedelta import relativedelta
from deepmerge import always_merger
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count, Q
from django.core import signing
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt, csrf_protect, ensure_csrf_cookie

import jsonschema
from rest_framework import permissions, status
from rest_framework.exceptions import APIException
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import JSONParser
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.serializers import ValidationError
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from camphoric import (
    accounts,
    audit,
    confirmations,
    deletes,
    invoices,
    models,
    pricing,
    roles,
    serializers,
)
from camphoric.lodging import get_lodging_schema
from camphoric.mail import batches, outbox, unsubscribe
from camphoric.permissions import AdminOnly, AdminWrites, IsAdmin, IsSuperuser, WritersOnly
from camphoric.templating import bulk, rules
from camphoric.templating.contexts import report_context
from camphoric.templating.emails import render_invitation_email
from camphoric.templating.pages import (
    FALLBACK_PAGE, page_failure_report, render_confirmation_page)
from camphoric.templating.env import LEGACY_REPORT_ENV
from camphoric.templating.graph import build_event_graph
from camphoric.templating.render import render_template
from camphoric.templating.urls import public_base


logger = logging.getLogger(__name__)


class SetCSRFCookieView(APIView):
    '''
    This endpoint sets the 'csrftoken' cookie, required for session-cookie-based
    authentication. Include the value of this cookie in the X-CSRFToken header
    for authenticated POST, PUT, PATCH, and DELETE requests, as well as
    /api/login requests.

    See also:
    - https://docs.djangoproject.com/en/3.2/ref/csrf/#ajax
    - https://www.django-rest-framework.org/api-guide/authentication/#sessionauthentication
    - https://yoongkang.com/blog/cookie-based-authentication-spa-django/
    '''
    permission_classes = [permissions.AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response({'detail': 'CSRF cookie set'})


class LoginView(APIView):
    '''
    Log in with session-cookie-based authentication. Requires a CSRF token. The
    request body should be JSON like:

        {"username": "myname", "password": "mypassword"}

    See also:
    - https://docs.djangoproject.com/en/3.2/topics/auth/default/#django.contrib.auth.login
    - https://www.django-rest-framework.org/api-guide/authentication/#sessionauthentication
    '''

    parser_classes = [JSONParser]
    permission_classes = [permissions.AllowAny]

    # By default, Django REST Framework requires CSRF tokens for authenticated
    # views only, so we need to explicitly add CSRF protection for the login endpoint
    @method_decorator(csrf_protect)
    def post(self, request, format=None):
        user = authenticate(
            request,
            username=request.data.get('username'),
            password=request.data.get('password'))
        if user is not None:
            login(request, user)
            return Response(serializers.CurrentUserSerializer(user).data)

        return Response({'detail': 'Login failed'}, status=400)


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        logout(request)

        return Response({'email': 'none', 'loggedIn': False})


class UserView(APIView):
    '''Who's signed in, with their Camphoric permission group (`role`; null for none).'''
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(serializers.CurrentUserSerializer(request.user).data)


class PlannedDeleteMixin:
    '''
    Deletes go by a plan (camphoric.deletes, SPEC DR-54): `GET …/{id}/delete-preview/`
    shows what a delete would do, and DELETE does it — or answers 409 with what's in
    the way. A view adds its own rules as `delete_checks`, and sets
    `delete_permission_classes` when deleting needs more than writing does. The
    preview asks the same permission as the delete.
    '''
    delete_permission_classes = None

    def get_permissions(self):
        if self.action in ('destroy', 'delete_preview') and self.delete_permission_classes:
            return [permission() for permission in self.delete_permission_classes]
        if self.action == 'delete_preview':
            return [WritersOnly()]
        return super().get_permissions()

    def delete_checks(self):
        return ()

    def delete_plan(self, instance):
        return deletes.plan(instance, self.delete_checks())

    def destroy(self, request, *args, **kwargs):
        self.delete_plan(self.get_object()).carry_out()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'], url_path='delete-preview')
    def delete_preview(self, request, pk=None):
        return Response(self.delete_plan(self.get_object()).preview())


class SoftDeleteMixin:
    '''
    Registrations, campers and payments are soft-deleted (SPEC DR-55): DELETE marks
    one deleted (the plan, above, says so), `POST …/{id}/restore/` brings it back,
    and `GET …/deleted/?event=` lists the deleted ones with who deleted them. A
    camper or payment whose registration is deleted comes back with it, so it's
    neither listed nor restored on its own.
    '''
    # Query parameter → lookup, for the deleted list; at least one is required.
    deleted_filters = {'event': 'registration__event', 'registration': 'registration'}
    # Annotations the deleted list adds to each row.
    deleted_extras = ()

    def get_any_object(self):
        '''The object, deleted or not.'''
        instance = get_object_or_404(self.queryset.model.all_objects, pk=self.kwargs['pk'])
        self.check_object_permissions(self.request, instance)
        return instance

    def deleted_queryset(self):
        return self.queryset.model.all_objects.filter(
            deleted_at__isnull=False, registration__deleted_at__isnull=True)

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        instance = self.get_any_object()
        if instance.deleted_at is None:
            raise serializers.Conflict('This isn\'t deleted.')
        registration = getattr(instance, 'registration', None)
        if registration is not None and registration.deleted_at is not None:
            raise serializers.Conflict('Restore the registration first.')
        instance.soft_undelete()
        return Response(self.get_serializer(instance).data)

    @action(detail=False, methods=['get'], permission_classes=[WritersOnly])
    def deleted(self, request):
        filters = {lookup: request.query_params[param]
                   for param, lookup in self.deleted_filters.items()
                   if request.query_params.get(param)}
        if not filters:
            raise ValidationError({name: 'This field is required.'
                                   for name in self.deleted_filters})
        instances = list(self.deleted_queryset().filter(**filters).order_by('-deleted_at', '-id'))
        deleters = audit.deleted_by(instances)
        rows = self.get_serializer(instances, many=True).data
        for row, instance in zip(rows, instances):
            row['deleted_by'] = deleters.get(instance.pk)
            for extra in self.deleted_extras:
                row[extra] = getattr(instance, extra)
        return Response(rows)


class OrganizationViewSet(PlannedDeleteMixin, ModelViewSet):
    '''Any role may list organizations; only Admins create, rename or delete them.'''
    queryset = models.Organization.objects.all()
    serializer_class = serializers.OrganizationSerializer
    permission_classes = [AdminWrites]
    # Its events keep it from being deleted (Event.organization is PROTECT).
    delete_permission_classes = [AdminOnly]


class EmailAccountViewSet(PlannedDeleteMixin, ModelViewSet):
    queryset = models.EmailAccount.objects.all()
    serializer_class = serializers.EmailAccountSerializer
    filterset_fields = ['organization']
    # Events using it, and email sent with it, keep it (PROTECT).

    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        '''Queue a test message through this account to `to` (default: the admin).'''
        account = self.get_object()
        to = request.data.get('to') or request.user.email
        if not to:
            raise ValidationError({'to': 'This field is required.'})
        message = outbox.enqueue(
            event=None,
            kind=models.EmailMessageKind.TEST,
            account=account,
            from_email=request.data.get('from_email') or account.username,
            to=to,
            subject=f'Test message from Camphoric ({account.name})',
            text=f'This is a test of the email account "{account.name}". It arrived, so the '
                 'account can send.',
            created_by=request.user,
        )
        return Response(serializers.EmailMessageDetailSerializer(message).data,
                        status=status.HTTP_202_ACCEPTED)


class EmailTemplateViewSet(PlannedDeleteMixin, ModelViewSet):
    '''The event's email templates: its confirmation, its invitations, its group emails.'''
    queryset = models.EmailTemplate.objects.order_by('purpose', 'name', 'id')
    serializer_class = serializers.EmailTemplateSerializer
    filterset_fields = ['event', 'purpose']

    def delete_checks(self):
        return (deletes.only_group_templates,)

    def group_template(self):
        template = self.get_object()
        if template.purpose != models.EmailTemplatePurpose.GROUP:
            raise ValidationError({'detail': 'Only group emails can be duplicated or sent.'})
        return template

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        template = self.group_template()
        template.pk = None
        template.name = f'{template.name} (copy)'
        template.save()
        return Response(self.get_serializer(template).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        '''
        Send to the reviewed recipients: `{recipient_keys, account?, from_email?,
        reply_to?, skip_already_sent?, send_at?}` → 202 with the batch.
        '''
        template = self.group_template()
        data = request.data
        send_at = None
        if data.get('send_at'):
            send_at = parse_datetime(str(data['send_at']))
            if send_at is None:
                raise ValidationError({'send_at': 'Give a date and time (ISO 8601).'})
        account = None
        if data.get('account'):
            account = get_object_or_404(models.EmailAccount, id=data['account'])
        try:
            batch = batches.create_batch(
                template, recipient_keys=data.get('recipient_keys') or [], account=account,
                from_email=data.get('from_email') or '', reply_to=data.get('reply_to') or '',
                skip_already_sent=data.get('skip_already_sent', True) is not False,
                send_at=send_at, created_by=request.user, link_base=public_base(request))
        except batches.BatchError as error:
            return Response({'detail': str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializers.EmailBatchSerializer(batch).data,
                        status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        '''
        Queue one copy, marked [Test], rendered for a recipient (`recipient_key`,
        else the first), to `to` (default: you). Unsaved `subject` / `body` and
        audience fields may be given.
        '''
        template = self.group_template()
        data = request.data
        to = data.get('to') or request.user.email
        if not to:
            raise ValidationError({'to': 'This field is required.'})
        audience = {name: data[name] for name in AUDIENCE_FIELDS if name in data}
        criteria = bulk.Criteria.from_request({
            **{name: getattr(template, name) for name in AUDIENCE_FIELDS}, **audience})
        try:
            message, rendered, chosen = batches.send_test(
                template, to=to, recipient_key=data.get('recipient_key'),
                subject=data.get('subject'), body=data.get('body'), created_by=request.user,
                criteria=criteria)
        except batches.BatchError as error:
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


AUDIENCE_FIELDS = ('recipient_source', 'filter', 'filter_expression', 'address_expression',
                   'name_expression', 'recipient_list', 'include_incomplete')


class EmailRecipientsView(APIView):
    '''
    POST: who a group email's audience reaches, from its fields (saved or not):
    `{recipient_source, filter, filter_expression, address_expression,
    name_expression, recipient_list, include_incomplete, template?}` →
    `{recipients: [{key, email, name, label, registration, camper,
    already_sent}], skipped, diagnostics}`. `already_sent` is against `template`.
    '''
    # Working out who an audience reaches only reads.
    read_only_methods = ('POST',)

    def post(self, request, event_id=None):
        event = get_object_or_404(models.Event, id=event_id)
        criteria = bulk.Criteria.from_request(request.data)
        resolution = bulk.resolve_recipients(event, criteria, request=request)
        result = resolution.as_dict()
        template_id = request.data.get('template')
        sent = batches.sent_keys(template_id) if template_id else set()
        for recipient in result['recipients']:
            recipient['already_sent'] = recipient['key'] in sent
        return Response(result)


class EmailUnsubscribeViewSet(PlannedDeleteMixin, ModelViewSet):
    '''
    The addresses that unsubscribed from an event's group email (`?event=`);
    an organizer can add one (someone who asked by reply) or remove one.
    '''
    queryset = models.EmailUnsubscribe.objects.select_related('created_by').order_by(
        '-created_at', '-id')
    serializer_class = serializers.EmailUnsubscribeSerializer
    filterset_fields = ['event']
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def perform_create(self, serializer):
        serializer.save(source=models.EmailUnsubscribeSource.ADMIN, created_by=self.request.user)


@method_decorator(csrf_exempt, name='dispatch')
class UnsubscribeView(View):
    '''
    GET /api/unsubscribe/<token>/: a page asking to confirm (a link scanner's
    GET changes nothing). POST — the page's button, or a mail provider's
    one-click `List-Unsubscribe=One-Click` (RFC 8058) — unsubscribes the
    token's address from the event's group email (SPEC DR-48). No login: the
    signed token is the permission.
    '''
    template = 'camphoric/unsubscribe.html'

    def target(self, request, token):
        try:
            event_id, address = unsubscribe.read_token(token)
        except signing.BadSignature:
            return None, None, render(request, self.template, {
                'problem': 'The unsubscribe link is incomplete or has been changed. '
                           'Try the link in the email again.'}, status=400)
        event = models.Event.objects.filter(id=event_id).first()
        if event is None:
            return None, None, render(request, self.template, {
                'problem': 'The event this email was about no longer exists, so it won’t '
                           'send you anything more.'}, status=404)
        return event, address, None

    def get(self, request, token):
        event, address, problem = self.target(request, token)
        if problem:
            return problem
        done = address in unsubscribe.unsubscribed(event)
        return render(request, self.template,
                      {'event_name': event.name, 'address': address, 'done': done})

    def post(self, request, token):
        event, address, problem = self.target(request, token)
        if problem:
            return problem
        unsubscribe.unsubscribe(event, address, source=models.EmailUnsubscribeSource.LINK)
        return render(request, self.template,
                      {'event_name': event.name, 'address': address, 'done': True})


class EmailRecipientFieldsView(APIView):
    '''GET ?source=registrations|campers: the fields recipients can be chosen by.'''

    def get(self, request, event_id=None):
        event = get_object_or_404(models.Event, id=event_id)
        source = request.query_params.get('source') or models.EmailRecipientSource.REGISTRATIONS
        return Response(rules.recipient_fields(event, source))


class EmailBatchViewSet(ReadOnlyModelViewSet):
    '''The event's group email sends, newest first, with their counts.'''
    serializer_class = serializers.EmailBatchSerializer
    filterset_fields = ['event', 'template', 'status']

    def get_queryset(self):
        return batches.with_counts(
            models.EmailBatch.objects.select_related('created_by').order_by('-created_at', '-id'))

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        batch = self.get_object()
        try:
            batches.cancel(batch)
        except batches.BatchError as error:
            return Response({'detail': str(error)}, status=status.HTTP_409_CONFLICT)
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=True, methods=['post'], url_path='retry-failed')
    def retry_failed(self, request, pk=None):
        retried = batches.retry_failed(self.get_object())
        return Response({'retried': retried, **self.get_serializer(self.get_object()).data})


class EmailMessagePagination(PageNumberPagination):
    page_size = 50


class EmailMessageViewSet(ReadOnlyModelViewSet):
    '''
    The email outbox and history (SPEC DR-44), newest first. Filter by event,
    kind, status (`kind__in`/`status__in` take comma-separated lists) and more;
    `q` searches the recipient and subject. The list leaves out the content.
    '''
    pagination_class = EmailMessagePagination
    filterset_fields = {
        'event': ['exact'],
        'batch': ['exact'],
        'template': ['exact'],
        'kind': ['exact', 'in'],
        'status': ['exact', 'in'],
        'registration': ['exact'],
        'invitation': ['exact'],
        'account': ['exact'],
    }

    def get_queryset(self):
        messages = (models.EmailMessage.objects.select_related('account', 'created_by')
                    .order_by('-created_at', '-id'))
        if roles.role_of(self.request.user) != roles.ADMIN:
            # Account email holds live set-password links (SPEC DR-52).
            messages = messages.exclude(kind=models.EmailMessageKind.ACCOUNT)
        search = self.request.query_params.get('q', '').strip()
        if search:
            messages = messages.filter(Q(to__icontains=search) | Q(subject__icontains=search))
        return messages

    def get_serializer_class(self):
        if self.action == 'list':
            return serializers.EmailMessageSerializer
        return serializers.EmailMessageDetailSerializer

    def _change(self, operation):
        message = self.get_object()
        try:
            operation(message)
        except outbox.NotAllowed as error:
            return Response({'detail': str(error)}, status=status.HTTP_409_CONFLICT)
        message.refresh_from_db()
        return Response(serializers.EmailMessageDetailSerializer(message).data)

    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        return self._change(outbox.retry)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        return self._change(outbox.cancel)


class EmailQueueView(APIView):
    '''
    GET: what the event's email is doing now: counts, the next attempt, whether
    a worker is running, and the sending account's limits.
    '''

    def get(self, request, event_id=None):
        event = get_object_or_404(models.Event, id=event_id)
        return Response(outbox.queue_state(event))


class EventViewSet(PlannedDeleteMixin, ModelViewSet):
    queryset = models.Event.objects.all()
    serializer_class = serializers.EventSerializer
    filterset_fields = ['organization']
    # Deleting an event deletes everything in it: Admins only, and not once
    # anyone has registered.
    delete_permission_classes = [AdminOnly]

    def delete_checks(self):
        return (deletes.no_registrations,)


class RegistrationViewSet(SoftDeleteMixin, PlannedDeleteMixin, ModelViewSet):
    queryset = models.Registration.objects.select_related('promo_code')
    serializer_class = serializers.RegistrationSerializer
    filterset_fields = ['event', 'completed']
    deleted_filters = {'event': 'event'}
    deleted_extras = ('camper_count',)

    def deleted_queryset(self):
        return models.Registration.all_objects.filter(deleted_at__isnull=False).annotate(
            camper_count=Count('campers', filter=Q(campers__deleted_at__isnull=True)))

    @action(detail=True, methods=['get'], permission_classes=[WritersOnly])
    def history(self, request, pk=None):
        '''The registration's audit log, with its campers, payments and charges (DR-53).'''
        return Response(audit.history(registration=self.get_any_object().id))


class ReportViewSet(PlannedDeleteMixin, ModelViewSet):
    queryset = models.Report.objects.all()
    serializer_class = serializers.ReportSerializer
    filterset_fields = ['event']


class RegistrationTypeViewSet(PlannedDeleteMixin, ModelViewSet):
    queryset = models.RegistrationType.objects.all()
    serializer_class = serializers.RegistrationTypeSerializer
    filterset_fields = ['event']

    def delete_checks(self):
        return (deletes.with_invitation_email,)


class InvitationViewSet(PlannedDeleteMixin, ModelViewSet):
    queryset = models.Invitation.objects.select_related('registration')
    serializer_class = serializers.InvitationSerializer
    filterset_fields = ['registration', 'registration_type__event']


class LodgingViewSet(PlannedDeleteMixin, ModelViewSet):
    queryset = models.Lodging.objects.all()
    serializer_class = serializers.LodgingSerializer
    filterset_fields = ['event']

    def delete_checks(self):
        return (deletes.unassign_campers,)


class CamperViewSet(SoftDeleteMixin, PlannedDeleteMixin, ModelViewSet):
    queryset = models.Camper.objects.all()
    serializer_class = serializers.CamperSerializer
    filterset_fields = ['registration__event', 'registration', 'registration__completed']

    @action(detail=True, methods=['get'], permission_classes=[WritersOnly])
    def history(self, request, pk=None):
        '''The camper's audit log, with its charges (DR-53).'''
        return Response(audit.history(camper=self.get_any_object().id))


class PricingOverrideViewSet(PlannedDeleteMixin, ModelViewSet):
    '''Registrars' amounts for single price lines of a registration or camper (SPEC DR-56).'''
    queryset = models.PricingOverride.objects.select_related('created_by', 'registration__event')
    serializer_class = serializers.PricingOverrideSerializer
    filterset_fields = ['registration', 'camper', 'registration__event']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class DepositViewSet(PlannedDeleteMixin, ModelViewSet):
    queryset = models.Deposit.objects.all()
    serializer_class = serializers.DepositSerializer
    filterset_fields = ['event']


def payment_problem_response(problem):
    return Response({'detail': problem.message, 'code': problem.code},
                    status=problem.http_status)


class InvoiceViewSet(PlannedDeleteMixin, ModelViewSet):
    '''
    A registration's invoices (SPEC §9.7, DR-87). Any role reads them; Registrars
    and Admins edit, cancel and reopen them and check a pending PayPal order;
    only Admins delete one, and only one nothing was ever paid on (DR-93).
    Invoices are made by the payment step and by recording payments.
    '''
    queryset = models.Invoice.objects.select_related('created_by', 'registration__event') \
        .prefetch_related('payments')
    serializer_class = serializers.InvoiceSerializer
    filterset_fields = ['registration', 'registration__event', 'registration__completed']
    delete_permission_classes = [AdminOnly]

    def create(self, request, *args, **kwargs):
        return Response({'detail': 'Invoices are made by the payment step and by recording '
                         'payments.'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def delete_checks(self):
        return (deletes.invoice_has_no_payments,)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        invoice = self.get_object()
        if invoice.cancelled_at is not None:
            raise serializers.Conflict('This invoice is already cancelled.')
        if invoice.amount_paid != 0:
            raise serializers.Conflict(
                'This invoice still holds money. Refund or move its payments first.')
        invoice.cancelled_at = timezone.now()
        invoice.cancel_reason = (request.data.get('reason') or '').strip()
        invoice.save()
        return Response(self.get_serializer(invoice).data)

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        invoice = self.get_object()
        if invoice.cancelled_at is None:
            raise serializers.Conflict('This invoice isn\'t cancelled.')
        invoice.cancelled_at = None
        invoice.cancel_reason = ''
        invoice.save()
        return Response(self.get_serializer(invoice).data)

    @action(detail=True, methods=['post'], url_path='check-paypal')
    def check_paypal(self, request, pk=None):
        '''Ask PayPal about the invoice's pending order: record it if captured, else clear it.'''
        try:
            result, payment = invoices.check_paypal_order(self.get_object())
        except invoices.PaymentProblem as problem:
            return payment_problem_response(problem)
        invoice = self.get_queryset().get(pk=pk)
        return Response({
            'result': result,
            'payment': serializers.PaymentSerializer(payment).data if payment else None,
            'invoice': self.get_serializer(invoice).data,
        })


class PaymentViewSet(SoftDeleteMixin, PlannedDeleteMixin, ModelViewSet):
    '''
    Payments and refunds (SPEC §9.7, DR-87, DR-94). Registrars and Admins record
    them and refund through PayPal; only Admins delete one (DR-93). A payment
    on a "Payment received" invoice keeps that invoice matching it.
    '''
    queryset = models.Payment.objects.select_related('invoice', 'registration__event')
    serializer_class = serializers.PaymentSerializer
    filterset_fields = ['registration', 'registration__event', 'invoice']
    delete_permission_classes = [AdminOnly]

    def delete_checks(self):
        return (deletes.payment_has_no_refunds, deletes.paypal_refund_stays_refunded)

    def destroy(self, request, *args, **kwargs):
        invoice = self.get_object().invoice
        with transaction.atomic():
            response = super().destroy(request, *args, **kwargs)
            invoices.match_received_invoice(invoice)
        return response

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        with transaction.atomic():
            response = super().restore(request, pk)
            invoices.match_received_invoice(self.get_any_object().invoice)
        return response

    @action(detail=True, methods=['post'], url_path='refund-paypal')
    def refund_paypal(self, request, pk=None):
        '''
        Refund some or all of a PayPal or card payment through PayPal: `{amount,
        reason, request_id}`. The refund is recorded as a negative payment.
        '''
        payment = self.get_object()
        request_id = request.data.get('request_id')
        if not request_id:
            raise ValidationError({'request_id': 'This field is required.'})
        try:
            amount = invoices.money(request.data.get('amount'))
        except Exception:
            raise ValidationError({'amount': 'A number is required.'})
        try:
            refund = invoices.refund_paypal_payment(
                payment, amount, (request.data.get('reason') or '').strip(), str(request_id),
                request=request)
        except invoices.PaymentProblem as problem:
            return payment_problem_response(problem)
        return Response(self.get_serializer(refund).data, status=status.HTTP_201_CREATED)


class PromoCodeViewSet(SoftDeleteMixin, PlannedDeleteMixin, ModelViewSet):
    '''
    An event's promo codes (SPEC DR-67). They're soft-deleted (DR-55), so the
    registrations that have one keep it — and their discount.
    '''
    queryset = models.PromoCode.objects.all()
    serializer_class = serializers.PromoCodeSerializer
    filterset_fields = ['event']
    deleted_filters = {'event': 'event'}

    def deleted_queryset(self):
        return models.PromoCode.all_objects.filter(deleted_at__isnull=False)

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        instance = self.get_any_object()
        if instance.deleted_at is not None and instance.clashes_with_live_code():
            raise serializers.Conflict(
                'Another promo code now uses this code. Change or delete it first.')
        return super().restore(request, pk)


class CustomChargeTypeViewSet(PlannedDeleteMixin, ModelViewSet):
    queryset = models.CustomChargeType.objects.all()
    serializer_class = serializers.CustomChargeTypeSerializer
    filterset_fields = ['event']


class CustomChargeViewSet(PlannedDeleteMixin, ModelViewSet):
    queryset = models.CustomCharge.objects.all()
    serializer_class = serializers.CustomChargeSerializer
    filterset_fields = ['camper', 'custom_charge_type__event']


class UserHistoryPagination(PageNumberPagination):
    page_size = 50


class UserViewSet(PlannedDeleteMixin, ModelViewSet):
    '''
    User management: Admins only, and a 404 for everyone else (SPEC DR-50,
    DR-52). Setting someone's password directly is for superusers only.
    '''
    queryset = User.objects.all().order_by('username')
    serializer_class = serializers.ManagedUserSerializer
    permission_classes = [IsAdmin]
    delete_permission_classes = [IsAdmin]

    def delete_checks(self):
        return (partial(deletes.not_yourself, self.request.user),)

    def perform_create(self, serializer):
        user = serializer.save()
        if getattr(user, '_send_password_link', False):
            try:
                accounts.send_password_link(
                    user, request=self.request, created_by=self.request.user)
            except accounts.AccountError as error:
                logger.warning(f'set-password link for {user.username} not sent: {error}')

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        '''
        What the user changed, in every event, newest first: the change-history
        entries (SPEC §5) they're credited with, 50 a page (`?page=`).
        '''
        paginator = UserHistoryPagination()
        page = paginator.paginate_queryset(audit.changes_by(self.get_object()), request, view=self)
        return paginator.get_paginated_response([audit.describe(entry) for entry in page])

    @action(detail=True, methods=['post'], url_path='send-password-link')
    def send_password_link(self, request, pk=None):
        '''Email the user a set-password link → 202 `{to, status, last_error}`.'''
        user = self.get_object()
        if not user.is_active:
            raise serializers.Conflict('Activate this user before sending a link.')
        try:
            message = accounts.send_password_link(user, request=request, created_by=request.user)
        except accounts.AccountError as error:
            raise serializers.Conflict(str(error))
        return Response({'to': message.to, 'status': message.status,
                         'last_error': message.last_error}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['post'], url_path='password-link')
    def password_link(self, request, pk=None):
        '''A set-password link to hand over yourself (no email needed) → `{url, expires_at}`.'''
        user = self.get_object()
        if not user.is_active:
            raise serializers.Conflict('Activate this user before making a link.')
        url = accounts.password_link(user, request)
        if not url:
            raise serializers.Conflict(
                'There is no public address to link to; set CAMPHORIC_PUBLIC_URL.')
        return Response({'url': url, 'expires_at': accounts.link_expires_at()})

    @action(detail=True, methods=['post'], url_path='set-password',
            permission_classes=[IsSuperuser])
    def set_password(self, request, pk=None):
        '''
        Superusers: set the user's password `{password, require_change = true}`
        → 204. It signs them out everywhere (and removes their API token).
        '''
        user = self.get_object()
        if user.pk == request.user.pk:
            raise serializers.Conflict('Change your own password from your account menu.')
        password = request.data.get('password') or ''
        problems = serializers.password_problems(password, user) if password \
            else ['This field is required.']
        if problems:
            return Response({'password': problems}, status=status.HTTP_400_BAD_REQUEST)
        accounts.set_password(user, password,
                              must_change=request.data.get('require_change', True) is not False)
        Token.objects.filter(user=user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChangePasswordView(APIView):
    '''
    POST /api/user/password `{current_password, new_password}` → 204: change
    your own password (and clear a must-change-password flag). You stay signed in.
    '''
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        current = request.data.get('current_password') or ''
        new = request.data.get('new_password') or ''
        if not user.check_password(current):
            return Response({'current_password': ['That isn\'t your current password.']},
                            status=status.HTTP_400_BAD_REQUEST)
        problems = serializers.password_problems(new, user) if new \
            else ['This field is required.']
        if not problems and new == current:
            problems = ['Choose a password different from your current one.']
        if problems:
            return Response({'new_password': problems}, status=status.HTTP_400_BAD_REQUEST)
        accounts.set_password(user, new, must_change=False)
        update_session_auth_hash(request, user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetRequestView(APIView):
    '''
    POST /api/password-reset `{email}` → 202, always with the same answer, so
    it doesn't reveal which addresses have accounts. Emails a set-password link
    to each active user with that address and a Camphoric permission group.
    Throttled (`password_reset`).
    '''
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'password_reset'
    ANSWER = ('If an account uses that address, we\'ve emailed it a link to choose a new '
              'password.')

    def post(self, request):
        email = str(request.data.get('email') or '').strip()
        if email:
            for user in User.objects.filter(email__iexact=email, is_active=True):
                if roles.role_of(user) is None:
                    continue
                try:
                    accounts.send_password_link(user, request=request)
                except accounts.AccountError as error:
                    logger.warning(f'password reset for {user.username} not sent: {error}')
        return Response({'detail': self.ANSWER}, status=status.HTTP_202_ACCEPTED)


class PasswordResetView(APIView):
    '''
    A set-password link (SPEC DR-52). GET /api/password-reset/<uid>/<token> →
    `{username}` while the link works; POST `{new_password}` → 204 sets the
    password (and clears a must-change flag). A used, expired or wrong link is
    a 400. It doesn't sign the user in.
    '''
    permission_classes = [permissions.AllowAny]
    INVALID = 'This link has expired or has already been used.'

    def get(self, request, uidb64, token):
        user = accounts.user_from_link(uidb64, token)
        if user is None:
            return Response({'detail': self.INVALID}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'username': user.username})

    def post(self, request, uidb64, token):
        user = accounts.user_from_link(uidb64, token)
        if user is None:
            return Response({'detail': self.INVALID}, status=status.HTTP_400_BAD_REQUEST)
        password = request.data.get('new_password') or ''
        problems = serializers.password_problems(password, user) if password \
            else ['This field is required.']
        if problems:
            return Response({'new_password': problems}, status=status.HTTP_400_BAD_REQUEST)
        accounts.set_password(user, password, must_change=False)
        return Response(status=status.HTTP_204_NO_CONTENT)


class InvitationError(Exception):
    def __init__(self, user_message):
        self.user_message = user_message


class PromoCodeRejected(APIException):
    '''
    A registration submitted with a promo code the registrant can't use: a 400
    whose `detail` the form shows as is (SPEC DR-67).
    '''
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = 'promo_code'
    default_detail = 'That promo code isn\'t valid for this event.'


class InvitationRejected(APIException):
    '''
    A registration submitted with an invitation that's no good: a 400 whose
    `detail` is the message for the registrant, which the form shows as is.
    '''
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = 'invitation'


class EventList(APIView):
    permission_classes = [permissions.AllowAny]
    filterset_fields = ['organization']

    def get(self, request):
        '''
        Return an array of objects with the following keys:
        - name: event name
        - url: url to the registration form for the event
        - open: whether registration is open for this event
        - registration_start: registration open date (ISO), or null
        - registration_end: registration close date (ISO), or null

        Events whose registration closed more than 3 months ago are omitted;
        events with no registration close date are always included.
        '''
        cutoff = datetime.date.today() - relativedelta(months=3)
        events = models.Event.objects.exclude(registration_end__lt=cutoff)

        def iso_or_none(value):
            return value.isoformat() if value else None

        def map_event(event):
            return {
                'name': event.name,
                'url': f"/events/{event.id}/register",
                'open': event.is_open(),
                'registration_start': iso_or_none(event.registration_start),
                'registration_end': iso_or_none(event.registration_end),
            }
        response_data = list(map(map_event, events))
        return Response(response_data)


template_sender = confirmations.template_sender
queue_report = confirmations.queue_report


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, event_id=None, format=None):
        '''
        Return an object with the following keys:
        - dataSchema: JSON schema to be used to render the registration form
        - uiSchema: react-jsonschema-form uses this to control form layout
        - pricing: key-value object with pricing variables
        - pricingLogic: Has keys: camper (camper level calculations) and
            registration (registration level calculations), which are each key-value
            objects describing the pricing components at the camper and registration
            level respectively. The key is an identifier for pricing component and
            the value is a JsonLogic* expression to calculate that component. All
            components will be summed together to calculate the final price. See
            test_pricing_fields() in test_views.py for an example.

        * http://jsonlogic.com/
        '''
        event = get_object_or_404(models.Event, id=event_id)

        (schema, ui_schema) = self.get_form_schema(event)

        response_data = {
            'dataSchema': schema,
            'uiSchema': ui_schema,
            'event': pricing.get_event_attributes(event),
            'pricing': event.pricing or {},
            'preSubmitTemplate': event.pre_submit_template or '',
            'templateVars': event.registration_template_vars or {},
            'registrationErrorMessages': event.registration_error_messages or {},
            'pricingLogic': {
                'camper': event.camper_pricing_logic or {},
                'registration': event.registration_pricing_logic or {},
            },
        }

        # Whether to offer a promo code field at all (SPEC DR-67).
        response_data['hasPromoCodes'] = any(
            promo_code.is_valid() for promo_code in event.promo_codes.all())

        if event.paypal_enabled and event.paypal_client_id:
            response_data['payPalOptions'] = {
                'clientId': event.paypal_client_id,
            }

        invitation = None
        try:
            invitation = self.find_invitation(request, event)
        except InvitationError as e:
            response_data['invitationError'] = e.user_message
        if invitation:
            response_data['invitation'] = {
                'recipient_name': invitation.recipient_name,
                'recipient_email': invitation.recipient_email,
                'invitation_code': invitation.invitation_code,
            }
            response_data['registrationType'] = {
                'name': invitation.registration_type.name,
                'label': invitation.registration_type.label,
            }
            response_data = self.apply_invitation_overrides(invitation, response_data)

        return Response(response_data)

    STEPS = ('registration', 'paypal-order', 'payment', 'finish')

    def post(self, request, event_id=None, format=None):
        '''
        The registration flow (SPEC §7, §9.7):

        - `registration`: the form; makes the (started) registration and returns
          its price and payment options.
        - `paypal-order`: the PayPal or Card button. Completes the registration,
          makes or updates its invoice, and creates the PayPal order.
        - `payment`: pay by check (or complete a $0 registration), or capture an
          approved PayPal order.
        - `finish`: finish without paying now, after a PayPal attempt didn't go
          through.
        '''
        event = get_object_or_404(models.Event, id=event_id)
        step = request.data.get('step', 'registration')
        if step == 'registration':
            return self.post_registration(request, event)
        if step == 'paypal-order':
            return self.post_paypal_order(request, event)
        if step == 'payment':
            return self.post_payment(request, event)
        if step == 'finish':
            return self.post_finish(request, event)
        raise ValidationError(
            {'step': 'Invalid value: must be one of ' + ', '.join(f'"{s}"' for s in self.STEPS)})

    def post_registration(self, request, event):
        form_data = request.data.get('formData')
        if form_data is None:
            raise ValidationError({'formData': 'This field is required.'})
        client_reported_pricing = request.data.get('pricingResults')
        if client_reported_pricing is None:
            raise ValidationError({'pricingResults': 'This field is required.'})
        invitation = None
        try:
            invitation = self.find_invitation(request, event)
        except InvitationError as e:
            raise InvitationRejected(e.user_message)
        # Outside the registration dates only an invitation gets in, so special
        # registration types can register after it closes (or before it opens).
        # A registration already accepted can always go on to pay.
        if invitation is None and not event.is_open():
            raise serializers.Conflict('Registration for this event is closed.')

        self.validate_form_data(event, form_data)

        registration, campers = self.deserialize_form_data(
            event, form_data)

        if invitation:
            registration.registration_type = invitation.registration_type

        registration.promo_code = self.find_promo_code(request, event)

        server_pricing_results = pricing.calculate_price(registration, campers)
        registration.server_pricing_results = server_pricing_results
        registration.client_reported_pricing = client_reported_pricing
        registration.save()

        if invitation:
            invitation.registration = registration
            invitation.save()

        camper_pricing = server_pricing_results['campers']
        for index, camper in enumerate(campers):
            camper.server_pricing_results = camper_pricing[index]
            camper.sequence = index
            camper.save()

        return Response({
            'registrationUUID': registration.uuid,
            'serverPricingResults': server_pricing_results,
            **self.payment_options(event, server_pricing_results),
        })

    @staticmethod
    def payment_options(event, server_pricing_results):
        '''The payment options, worked out on the server (#675), and the handling percent.'''
        meta, options = invoices.payment_options(event, server_pricing_results)
        online = event.paypal_enabled and event.epayment_handling
        return {
            'paymentOptions': {**meta, 'options': [option.as_dict() for option in options]},
            'handlingPercent': float(event.epayment_handling) if online else None,
        }

    def find_promo_code(self, request, event):
        '''The promo code the registrant entered, if any; one they can't use is refused.'''
        code = request.data.get('promoCode')
        if not isinstance(code, str) or not code.strip():
            return None
        promo_code = models.PromoCode.find_valid(event, code)
        if promo_code is None:
            raise PromoCodeRejected()
        return promo_code

    @staticmethod
    def locked_registration(request):
        '''
        The registration the request names, locked: a repeated or concurrent POST
        (a retry, a double click) waits for the first, then sees what it did.
        '''
        registration_uuid = request.data.get('registrationUUID')
        if registration_uuid is None:
            raise ValidationError({'registrationUUID': 'This field is required.'})
        return get_object_or_404(
            models.Registration.objects.select_for_update(), uuid=registration_uuid)

    @staticmethod
    def payment_type(request, event, online=None):
        payment_type = request.data.get('paymentType')
        if payment_type is None and online is False:
            return models.PaymentType.CHECK  # e.g. completing a $0 registration
        if payment_type is None:
            raise ValidationError({'paymentType': 'This field is required'})
        allowed = event.valid_payment_types
        if online is not None:
            allowed = [t for t in allowed if (t in invoices.ONLINE_TYPES) == online]
        if payment_type not in allowed:
            raise ValidationError({
                'paymentType': 'Invalid value: must be one of ' + ', '.join(allowed)
            })
        return payment_type

    @staticmethod
    def chosen_option(request, registration):
        '''
        The payment option the registrant chose, by name (the default if none).
        A browser loaded before options moved to the server sends the old shape:
        it's asked to reload rather than trusted (its PayPal order, if any, was
        never captured by the server, so no money moved).
        '''
        if 'paymentData' in request.data or 'payPalResponse' in request.data:
            raise serializers.Conflict(
                'This page is out of date. Please reload it and try again.')
        name = request.data.get('paymentOption')
        option = invoices.find_option(
            registration.event, registration.server_pricing_results, name)
        if option is None:
            raise ValidationError({'paymentOption': f'There\'s no payment option "{name}".'})
        return option

    @staticmethod
    def payable(registration):
        '''The registration invoice can still change: nothing has been paid on it.'''
        return not invoices.has_payments(invoices.registration_invoice(registration))

    @staticmethod
    def complete(registration):
        '''A payment button was pressed: the registration is completed, unpaid (DR-91).'''
        if registration.completed:
            return
        registration.completed = True
        registration.completed_at = timezone.now()
        registration.save()

    def problem_response(self, request, registration, problem):
        return Response({
            'detail': problem.message,
            'code': problem.code,
            'invoice': self.invoice_data(invoices.registration_invoice(registration)),
        }, status=problem.http_status)

    @staticmethod
    def invoice_data(invoice):
        return serializers.InvoiceSerializer(invoice).data if invoice is not None else None

    def post_paypal_order(self, request, event):
        '''
        The PayPal or Card button: complete the registration, make or rewrite its
        invoice for the chosen option, and create the PayPal order for it, with
        the handling fee (DR-90, DR-91). Returns `{orderID, total, handling}`.
        '''
        payment_type = self.payment_type(request, event, online=True)
        if not event.paypal_client_id:
            raise serializers.Conflict('This event doesn\'t take payments online.')
        with transaction.atomic():
            registration = self.locked_registration(request)
            option = self.chosen_option(request, registration)
            if not self.payable(registration):
                raise serializers.Conflict('This registration has already been paid.')
            if option.amount <= 0:
                raise ValidationError({'paymentOption': 'Nothing is due for this option.'})
            self.complete(registration)
            invoice = invoices.prepare_registration_invoice(registration, option, payment_type)
            try:
                order_id = invoices.create_paypal_order(invoice, payment_type)
            except invoices.PaymentProblem as problem:
                return self.problem_response(request, registration, problem)
            return Response({
                'orderID': order_id,
                'total': float(option.amount + option.handling),
                'handling': float(option.handling),
                'invoice': self.invoice_data(invoice),
            })

    def post_payment(self, request, event):
        '''
        Pay by check (the chosen option; nothing to choose for a $0 registration),
        or capture the PayPal order the registrant approved. Either way the
        registration is completed and its confirmation sent; a PayPal payment
        that doesn't go through leaves it completed and unpaid, and says why.
        '''
        payment_type = request.data.get('paymentType') or models.PaymentType.CHECK
        with transaction.atomic():
            registration = self.locked_registration(request)
            if payment_type in invoices.ONLINE_TYPES:
                self.payment_type(request, event, online=True)
                return self.capture(request, registration, payment_type)
            self.payment_type(request, event, online=False)
            if registration.completed and not self.payable(registration):
                # Already paid: the same result again, without a second email.
                return Response(self.payment_result(request, registration))
            total = invoices.money((registration.server_pricing_results or {}).get('total'))
            if total > 0 or 'paymentOption' in request.data:
                option = self.chosen_option(request, registration)
                invoices.prepare_registration_invoice(registration, option, payment_type)
            self.complete(registration)
            confirmations.send_confirmation(registration, request)
            return Response(self.payment_result(request, registration))

    def capture(self, request, registration, payment_type):
        order_id = request.data.get('paypalOrderId')
        if not order_id:
            if 'payPalResponse' in request.data:
                raise serializers.Conflict(
                    'This page is out of date. Please reload it and try again.')
            raise ValidationError({'paypalOrderId': 'This field is required.'})
        invoice = invoices.registration_invoice(registration)
        if invoice is None or not registration.completed:
            raise serializers.Conflict('There\'s no PayPal payment waiting for this registration.')
        try:
            invoices.capture_paypal_order(
                invoice, order_id, payment_type, notes='Initial payment', request=request)
        except invoices.PaymentProblem as problem:
            if problem.code == 'unknown':
                # Money may have moved: the registrant is told not to pay again,
                # and gets their confirmation now.
                confirmations.send_confirmation(registration, request)
            return self.problem_response(request, registration, problem)
        confirmations.send_confirmation(registration, request)
        return Response(self.payment_result(request, registration))

    def post_finish(self, request, event):
        '''Finish without paying now: the confirmation says what's still due.'''
        with transaction.atomic():
            registration = self.locked_registration(request)
            if not registration.completed:
                raise serializers.Conflict('Choose how to pay first.')
            confirmations.send_confirmation(registration, request)
            return Response(self.payment_result(request, registration))

    def payment_result(self, request, registration):
        registration.refresh_from_db()
        return {
            # Rendered on the server (markdown); the client only displays it (SPEC §7.3).
            'confirmationPage': self.confirmation_page(request, registration),
            'serverPricingResults': registration.server_pricing_results,
            # The confirmation couldn't be queued. Delivery happens later, so a
            # delivery failure shows in the email history, not here.
            'emailError': confirmations.confirmation_email_problem(registration),
            'invoice': self.invoice_data(invoices.registration_invoice(registration)),
            'ledger': invoices.ledger(registration).as_dict(),
        }

    @staticmethod
    def confirmation_page(request, registration):
        '''
        The rendered confirmation page (markdown). If it can't be rendered, the
        registrant gets a short generic message and the organizer a report
        (SPEC §7.3, DR-42).
        '''
        result = render_confirmation_page(registration, request=request)
        if result.ok:
            return result.output
        subject, body = page_failure_report(registration, result.diagnostics, request=request)
        logger.error(f'{subject}\n{body}')
        queue_report(registration, models.EmailMessageKind.PAGE_REPORT, subject, body)
        return FALLBACK_PAGE

    @classmethod
    def get_form_schema(cls, event):
        (lodging_schema, lodging_ui_schema) = get_lodging_schema(event)

        schema = {
            **event.registration_schema,
            'definitions': {
                **event.registration_schema.get('definitions', {}),
                'camper': {
                    **event.camper_schema,
                    'properties': {
                        **event.camper_schema.get('properties', {}),
                        'lodging': lodging_schema,
                    },
                } if lodging_schema else event.camper_schema,
            },
            'required': [
                *event.registration_schema.get('required', []),
                'registrant_email',
            ],
            'properties': {
                'registrant_email': {
                    'type': 'string',
                    'format': 'email',
                    # https://pythex.org/
                    # Found a regex that will work with both JS and python
                    'pattern': r'^[a-zA-Z0-9_+\.-]+@([\w-]+\.)+[\w-]{2,4}$',
                    'title': 'Registrant email',
                },
                **event.registration_schema.get('properties', {}),
                'campers': {
                    'type': 'array',
                    'minItems': 1,
                    'maxItems': 20,
                    'items': {
                        '$ref': '#/definitions/camper',
                    },
                },
            },
        }

        # The server supplies the lodging field's uiSchema (the cascading
        # selector, disabled full nodes, the comments textarea); merge it
        # per field so an event can still add to a field (e.g. a
        # `ui:description` on `lodging_comments`) without losing the
        # server's widget settings.
        event_lodging_ui = (event.registration_ui_schema
                            .get('campers', {})
                            .get('items', {})
                            .get('lodging', {}))
        lodging_ui = {**event_lodging_ui}
        for key, value in (lodging_ui_schema or {}).items():
            existing = lodging_ui.get(key)
            if isinstance(value, dict) and isinstance(existing, dict):
                lodging_ui[key] = {**value, **existing}
            else:
                lodging_ui[key] = value

        ui_schema = {
            **event.registration_ui_schema,
            'campers': {
                **event.registration_ui_schema.get('campers', {}),
                'items': {
                    **event.registration_ui_schema.get('campers', {}).get('items', {}),
                    'lodging': lodging_ui,
                },
            },
        }

        return schema, ui_schema

    @classmethod
    def validate_form_data(cls, event, form_data):
        (schema, _) = cls.get_form_schema(event)
        # Draft 7, as the registration form validates in the browser: event
        # schemas declare no $schema, and the newer drafts jsonschema would
        # otherwise assume drop `dependencies`, which the schemas use for their
        # conditional fields.
        validator = jsonschema.Draft7Validator(
            schema, format_checker=jsonschema.Draft7Validator.FORMAT_CHECKER)
        try:
            validator.validate(form_data)
        except jsonschema.exceptions.ValidationError as e:
            # Array indexes come through as ints (campers.0.name).
            path = '.'.join(str(part) for part in e.absolute_path)
            raise ValidationError({path: e.message})

    @classmethod
    def deserialize_form_data(cls, event, form_data):
        registration_attributes = {
            k: v for k, v in form_data.items()
            if k not in ['campers', 'registrant_email']
        }
        registration = models.Registration(
            event=event,
            registrant_email=form_data['registrant_email'],
            attributes=registration_attributes,
        )

        campers = [
            cls.deserialize_camper(registration, camper_data)
            for camper_data in form_data['campers']
        ]

        return registration, campers

    @classmethod
    def deserialize_camper(cls, registration, camper_data):
        '''
        Transform a dict from the `campers` list in the form data into a Camper
        model instance. The biggest thing this does is to transform the lodging
        data into a form that can be saved into the model.
        '''

        lodging_data = {}
        lodging_id = None
        if 'lodging' in camper_data:
            lodging_data = camper_data['lodging']
            lodging_id = lodging_data['lodging_requested']['id']
            del camper_data['lodging']

        return models.Camper(
            registration=registration,
            attributes=camper_data,
            lodging_id=lodging_id,
            lodging_requested_id=lodging_id,
            lodging_shared=lodging_data.get('lodging_shared', False),
            lodging_shared_with=lodging_data.get('lodging_shared_with', ''),
            lodging_comments=lodging_data.get('lodging_comments', ''),
        )

    @classmethod
    def apply_invitation_overrides(cls, invitation, response_data):
        registration_type = invitation.registration_type
        always_merger.merge(
                response_data['dataSchema'],
                registration_type.registration_schema_overrides)
        always_merger.merge(
                response_data['dataSchema']['definitions']['camper'],
                registration_type.camper_schema_overrides)
        always_merger.merge(
                response_data['uiSchema'],
                registration_type.ui_schema_overrides)
        return response_data

    @classmethod
    def find_invitation(cls, request, event):
        '''The request's invitation to this event, or None; InvitationError if it's no good.'''
        email, code = None, None
        if request.method == 'POST' and 'invitation' in request.data:
            email = request.data['invitation'].get('recipient_email')
            code = request.data['invitation'].get('invitation_code')
        else:
            params = request.query_params
            email = params.get('email')
            code = params.get('code')

        if not (email and code):
            return None

        invitation = None
        try:
            invitation = models.Invitation.objects.get(
                recipient_email=email,
                invitation_code=code,
            )
        except models.Invitation.DoesNotExist:
            raise InvitationError(
                f'Sorry, we couldn\'t find an invitation for "{email}" with code "{code}"')

        # A code for another event mustn't open this one, or bring its registration type.
        if getattr(invitation.registration_type, 'event_id', None) != event.id:
            raise InvitationError('Sorry, that invitation is for a different event')

        if invitation.registration and invitation.registration.completed:
            raise InvitationError('Sorry, that invitation code has already been redeemed')

        if invitation.expiration_time and invitation.expiration_time < timezone.now():
            raise InvitationError('Sorry, that invitation code has expired')

        return invitation


class CheckPromoCodeView(APIView):
    '''
    POST /api/events/<id>/checkpromo `{code}` → 200 `{code, label, scope,
    pricingLogic}` for a code a registrant can use now (enough for the form to
    price the discount live), or 400 `{detail}` (SPEC DR-67). Anyone may ask;
    throttled (`promo_code_check`) so codes can't be guessed wholesale.
    '''
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'promo_code_check'

    def post(self, request, event_id=None):
        event = get_object_or_404(models.Event, id=event_id)
        code = request.data.get('code')
        promo_code = models.PromoCode.find_valid(event, code) if isinstance(code, str) else None
        if promo_code is None:
            raise PromoCodeRejected()
        return Response({
            'code': promo_code.code,
            'label': promo_code.label,
            'scope': promo_code.scope,
            'pricingLogic': promo_code.pricing_logic,
        })


class SendInvitationView(APIView):

    def post(self, request, invitation_id=None):
        '''
        - Takes an invitation
        - generates an email with a link to the registration form that will redeem that invitation
        - queues the email; delivering it sets the sent_time on the invitation
        '''
        invitation = get_object_or_404(models.Invitation, id=invitation_id)
        to_name = invitation.recipient_name
        to_email = invitation.recipient_email
        event = invitation.registration_type.event
        rendered = render_invitation_email(invitation, request=request)
        if not rendered.ok:
            # A Jinja template that can't be rendered: nothing is sent.
            return Response({
                'detail': 'The invitation email template has problems; nothing was sent.',
                'diagnostics': [d.as_dict() for d in rendered.diagnostics],
            }, status=status.HTTP_400_BAD_REQUEST)

        message = outbox.enqueue(
            event=event,
            kind=models.EmailMessageKind.INVITATION,
            invitation=invitation,
            **template_sender(invitation.registration_type.invitation_template, event),
            to=f'"{to_name}" <{to_email}>' if to_name else to_email,
            subject=rendered.subject,
            text=rendered.text,
            html=rendered.html,
            created_by=request.user,
        )
        if message.status in (models.EmailMessageStatus.FAILED,
                              models.EmailMessageStatus.CANCELLED):
            return Response({'detail': message.last_error}, status=status.HTTP_400_BAD_REQUEST)

        # Queued: the worker sends it and sets the invitation's sent_time.
        return Response({
            'success': True,
            'messageId': message.id,
            'status': message.status,
        })


class RenderReportView(APIView):
    # Rendering reads; a Reporter may render.
    read_only_methods = ('POST',)

    def post(self, request, report_id=None):
        '''
        Render a Jinja report (hbs reports are returned as-is for the client).

        Reports with `variables_source == 'server'` render against the event's
        variable graph (SPEC §9.3) and ignore the request body; they also return
        structured `diagnostics`. Older reports render with the variables the
        client posts, in a sandboxed environment that lets them change the
        posted data as they always have (DR-37).
        '''
        report = get_object_or_404(models.Report, id=report_id)

        if report.output == models.ReportOutputType.HANDLEBARS:
            return Response({'report': report.template, 'error': None})

        if report.variables_source == models.ReportVariablesSource.SERVER:
            graph = build_event_graph(report.event, request=request)
            result = render_template(
                report.template, report_context(graph),
                fmt='html' if report.output == models.ReportOutputType.HTML else 'text')
            return Response({
                'report': result.output if result.ok else '',
                'error': result.error,
                'diagnostics': [d.as_dict() for d in result.diagnostics],
            })

        output = report.template
        error = None
        try:
            output = LEGACY_REPORT_ENV \
                .from_string(report.template) \
                .render(**request.data)
        except Exception as e:
            tb = traceback.format_exc() or ''
            start = tb.find('File "<template>"')
            if start < 0:
                start = tb.find('File "<unknown>"')
            emessage = tb[start:]

            error = str(e) + "\n" + emessage + str(start)
            output = ''

        return Response({
            'report': output,
            'error': error
        })


class LodgingSchemaView(APIView):

    def get(self, request, event_id=None):
        '''
        Given an event, return its lodging selection schema and UI schema for
        react-jsonschema-form, including the full lodging tree regardless of
        public visibility.
        '''
        event = get_object_or_404(models.Event, id=event_id)
        (lodging_schema, lodging_ui_schema) = get_lodging_schema(event, show_all=True)

        return Response({
            'lodging_schema': lodging_schema,
            'lodging_ui_schema': lodging_ui_schema,
        })

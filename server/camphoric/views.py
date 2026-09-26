from dataclasses import asdict
import datetime
import logging
import traceback

from dateutil.relativedelta import relativedelta
from decimal import Decimal
from deepmerge import always_merger
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import ProtectedError, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie

import jsonschema
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.serializers import ValidationError
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from camphoric import (
    models,
    pricing,
    serializers,
)
from camphoric.lodging import get_lodging_schema
from camphoric.mail import batches, outbox
from camphoric.paypal import PayPalClient
from camphoric.templating import bulk, rules
from camphoric.templating.contexts import report_context
from camphoric.templating.emails import (
    confirmation_failure_report, render_confirmation_email, render_invitation_email)
from camphoric.templating.pages import (
    FALLBACK_PAGE, page_failure_report, render_confirmation_page)
from camphoric.templating.env import LEGACY_REPORT_ENV
from camphoric.templating.graph import build_event_graph
from camphoric.templating.render import render_template


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
            return Response(serializers.UserSerializer(user).data)

        return Response({'detail': 'Login failed'}, status=400)


class LogoutView(APIView):
    def post(self, request):
        logout(request)

        return Response({'email': 'none', 'loggedIn': False})


class UserView(APIView):
    def get(self, request):
        return Response(serializers.UserSerializer(request.user).data)


class OrganizationViewSet(ModelViewSet):
    queryset = models.Organization.objects.all()
    serializer_class = serializers.OrganizationSerializer
    permission_classes = [permissions.IsAdminUser]


class EmailAccountViewSet(ModelViewSet):
    queryset = models.EmailAccount.objects.all()
    serializer_class = serializers.EmailAccountSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['organization']

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {'detail': 'This account is still used by an event or by sent email, so it '
                           "can't be deleted. Choose another account for those events first."},
                status=status.HTTP_409_CONFLICT)

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


class EmailTemplateViewSet(ModelViewSet):
    '''The event's email templates: its confirmation, its invitations, its group emails.'''
    queryset = models.EmailTemplate.objects.order_by('purpose', 'name', 'id')
    serializer_class = serializers.EmailTemplateSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['event', 'purpose']

    def destroy(self, request, *args, **kwargs):
        if self.get_object().purpose != models.EmailTemplatePurpose.GROUP:
            return Response(
                {'detail': 'The confirmation and invitation emails can\'t be deleted; '
                           'edit them instead.'},
                status=status.HTTP_409_CONFLICT)
        return super().destroy(request, *args, **kwargs)

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
                send_at=send_at, created_by=request.user)
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
    permission_classes = [permissions.IsAdminUser]

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


class EmailRecipientFieldsView(APIView):
    '''GET ?source=registrations|campers: the fields recipients can be chosen by.'''
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, event_id=None):
        event = get_object_or_404(models.Event, id=event_id)
        source = request.query_params.get('source') or models.EmailRecipientSource.REGISTRATIONS
        return Response(rules.recipient_fields(event, source))


class EmailBatchViewSet(ReadOnlyModelViewSet):
    '''The event's group email sends, newest first, with their counts.'''
    permission_classes = [permissions.IsAdminUser]
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
    permission_classes = [permissions.IsAdminUser]
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
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, event_id=None):
        event = get_object_or_404(models.Event, id=event_id)
        return Response(outbox.queue_state(event))


class EventViewSet(ModelViewSet):
    queryset = models.Event.objects.all()
    serializer_class = serializers.EventSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['organization']


class RegistrationViewSet(ModelViewSet):
    queryset = models.Registration.objects.all()
    serializer_class = serializers.RegistrationSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['event', 'completed']


class ReportViewSet(ModelViewSet):
    queryset = models.Report.objects.all()
    serializer_class = serializers.ReportSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['event']


class RegistrationTypeViewSet(ModelViewSet):
    queryset = models.RegistrationType.objects.all()
    serializer_class = serializers.RegistrationTypeSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['event']


class InvitationViewSet(ModelViewSet):
    queryset = models.Invitation.objects.all()
    serializer_class = serializers.InvitationSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['registration', 'registration_type__event']


class LodgingViewSet(ModelViewSet):
    queryset = models.Lodging.objects.all()
    serializer_class = serializers.LodgingSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['event']


class CamperViewSet(ModelViewSet):
    queryset = models.Camper.objects.all()
    serializer_class = serializers.CamperSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['registration__event', 'registration', 'registration__completed']


class DepositViewSet(ModelViewSet):
    queryset = models.Deposit.objects.all()
    serializer_class = serializers.DepositSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['event']


class PaymentViewSet(ModelViewSet):
    queryset = models.Payment.objects.all()
    serializer_class = serializers.PaymentSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['registration', 'registration__event']


class CustomChargeTypeViewSet(ModelViewSet):
    queryset = models.CustomChargeType.objects.all()
    serializer_class = serializers.CustomChargeTypeSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['event']


class CustomChargeViewSet(ModelViewSet):
    queryset = models.CustomCharge.objects.all()
    serializer_class = serializers.CustomChargeSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['camper', 'custom_charge_type__event']


class UserViewSet(ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = serializers.UserSerializer
    permission_classes = [permissions.IsAdminUser]


class InvitationError(Exception):
    def __init__(self, user_message):
        self.user_message = user_message


class PaymentError(Exception):
    def __init__(self, message):
        self.message = message

    def __str__(self):
        return f'PaymentError: {self.message}'


class EventList(APIView):
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


def template_sender(template, event):
    '''
    Who an email template's email comes from: its own sender, reply-to and
    account where set, else the event's address and account.
    '''
    sender = {'from_email': event.confirmation_email_from}
    if template:
        sender['from_email'] = template.sender
        if template.reply_to:
            sender['reply_to'] = template.reply_to
        if template.account_id:
            sender['account'] = template.account
    return sender


def queue_report(registration, kind, subject, body):
    '''
    Queue a template problem report to the event's "from" address, at most once
    per registration and kind.
    '''
    event = registration.event
    if not event.confirmation_email_from:
        return
    outbox.enqueue(
        event=event,
        kind=kind,
        registration=registration,
        from_email=event.confirmation_email_from,
        to=event.confirmation_email_from,
        subject=subject,
        text=body,
        dedupe_key=f'{kind}:{registration.id}',
    )


class RegisterView(APIView):
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

        if event.paypal_enabled and event.paypal_client_id:
            response_data['payPalOptions'] = {
                'clientId': event.paypal_client_id,
            }

        invitation = None
        try:
            invitation = self.find_invitation(request)
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

    def post(self, request, event_id=None, format=None):
        event = get_object_or_404(models.Event, id=event_id)
        step = request.data.get('step', 'registration')
        if step == 'registration':
            return self.post_registration(request, event)
        elif step == 'payment':
            return self.post_payment(request, event)
        else:
            raise ValidationError(
                {'step': 'Invalid value: must be "registration" or "payment"'})

    def post_registration(self, request, event):
        form_data = request.data.get('formData')
        if form_data is None:
            raise ValidationError({'formData': 'This field is required.'})
        client_reported_pricing = request.data.get('pricingResults')
        if client_reported_pricing is None:
            raise ValidationError({'pricingResults': 'This field is required.'})
        self.validate_form_data(event, form_data)

        registration, campers = self.deserialize_form_data(
            event, form_data)

        invitation = None
        try:
            invitation = self.find_invitation(request)
        except InvitationError as e:
            raise ValidationError(e.user_message)
        if invitation:
            registration.registration_type = invitation.registration_type

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
            'deposit': registration.event.registration_deposit_schema,
        })

    def post_payment(self, request, event):
        registration_uuid = request.data.get('registrationUUID')
        if registration_uuid is None:
            raise ValidationError({'registrationUUID': 'This field is required.'})

        payment_type = request.data.get('paymentType')
        if payment_type is None:
            raise ValidationError({'paymentType': 'This field is required'})
        if payment_type not in event.valid_payment_types:
            raise ValidationError({
                'paymentType': 'Invalid value: must be one of ' +
                               ', '.join(event.valid_payment_types)
            })

        # The lock makes a repeated or concurrent POST (a retry, a double click)
        # wait for the first; it then finds the registration completed and gets
        # the same result, without a second payment or confirmation email.
        with transaction.atomic():
            registration = get_object_or_404(
                models.Registration.objects.select_for_update(), uuid=registration_uuid)
            if not registration.completed:
                self.complete_registration(request, registration, payment_type)
            return Response(self.payment_result(request, registration))

    def complete_registration(self, request, registration, payment_type):
        # Do a save here because payment type could affect pricing
        registration.payment_type = payment_type
        registration.save()
        registration.refresh_from_db()

        registration.initial_payment = request.data.get('paymentData')
        registration.initial_payment['balance'] = pricing.money_fmt(
            Decimal(registration.server_pricing_results['total'])
            - Decimal(registration.initial_payment['total'])
        )

        is_paypal_captured_payment = (
            payment_type == models.PaymentType.PAYPAL or
            payment_type == models.PaymentType.CARD
        )

        if is_paypal_captured_payment:
            paypal_response = request.data.get('payPalResponse')
            if paypal_response is None:
                raise ValidationError({'payPalResponse': 'This field is required.'})
            registration.paypal_response = paypal_response

        registration.completed = True
        registration.save()

        if is_paypal_captured_payment:
            try:
                self.verify_and_save_paypal_payment(registration)
            except Exception as e:
                # fail open
                traceback.print_exc()
                message = 'verify_and_save_paypal_payment failed for registration ' \
                          f'{registration.id}: {e}'
                logger.error(message)

        email_error = self.queue_confirmation_email(request, registration)
        if email_error:
            logger.error(f'confirmation email not queued: {email_error}')

    def payment_result(self, request, registration):
        return {
            # Rendered on the server (markdown); the client only displays it (SPEC §7.3).
            'confirmationPage': self.confirmation_page(request, registration),
            'serverPricingResults': registration.server_pricing_results,
            # The confirmation couldn't be queued. Delivery happens later, so a
            # delivery failure shows in the email history, not here.
            'emailError': self.confirmation_email_problem(registration),
            'initialPayment': registration.initial_payment,
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

    @staticmethod
    def queue_confirmation_email(request, registration):
        '''
        Queue the registrant's confirmation; returns why it couldn't be, or None.
        If a Jinja template can't be rendered, the registrant is sent nothing and
        a report goes to the event's "from" address instead (SPEC §8.3, DR-38).
        '''
        event = registration.event
        rendered = render_confirmation_email(registration, request=request)
        if not rendered.ok:
            subject, body = confirmation_failure_report(registration, rendered, request=request)
            logger.error(f'{subject}\n{body}')
            queue_report(registration, models.EmailMessageKind.CONFIRMATION_REPORT, subject, body)
            return 'the confirmation email template could not be rendered'

        message = outbox.enqueue(
            event=event,
            kind=models.EmailMessageKind.CONFIRMATION,
            registration=registration,
            **template_sender(event.confirmation_template, event),
            to=registration.registrant_email,
            subject=rendered.subject,
            text=rendered.text,
            html=rendered.html,
            dedupe_key=f'confirmation:{registration.id}',
        )
        if message.status in (models.EmailMessageStatus.FAILED,
                              models.EmailMessageStatus.CANCELLED):
            return message.last_error
        return None

    @staticmethod
    def confirmation_email_problem(registration):
        '''Whether the registration's confirmation email couldn't be queued.'''
        message = models.EmailMessage.objects.filter(
            dedupe_key=f'confirmation:{registration.id}').first()
        return message is None or message.status in (
            models.EmailMessageStatus.FAILED, models.EmailMessageStatus.CANCELLED)

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
        try:
            jsonschema.validate(
                form_data,
                schema,
                format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER,
                )
        except jsonschema.exceptions.ValidationError as e:
            path = '.'.join(e.absolute_path)
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
    def find_invitation(cls, request):
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

        if invitation.registration and invitation.registration.completed:
            raise InvitationError('Sorry, that invitation code has already been redeemed')

        if invitation.expiration_time and invitation.expiration_time < timezone.now():
            raise InvitationError('Sorry, that invitation code has expired')

        return invitation

    @classmethod
    def verify_and_save_paypal_payment(cls, registration):
        order_details_from_client = registration.paypal_response
        order_id = order_details_from_client['id']
        paypal_client = PayPalClient(
            settings.PAYPAL_BASE_URL,
            registration.event.paypal_client_id,
            # TODO: need to move this to DB so that events can have different
            # PayPal accounts on the same server
            settings.PAYPAL_SECRET,
        )

        notes = "Initial payment"
        order_details = paypal_client.fetch_order_details(order_id)

        if order_details['status'] != 'COMPLETED':
            raise PaymentError('order incomplete')
        registration_uuid_found = False
        total = 0
        for unit in order_details['purchase_units']:
            if unit['reference_id'] == str(registration.uuid):
                registration_uuid_found = True
            amount = unit['amount']
            if amount['currency_code'] != 'USD':
                raise PaymentError(f'unexpected currency code {amount["currency_code"]}')
            total += pricing.money_fmt(float(amount['value']))
            if 'custom_id' in unit and unit['custom_id'] != '':
                notes = notes+": "+unit['custom_id']

        if not registration_uuid_found:
            raise PaymentError('registration.uuid not found in order')
        # This is commented out for now until we refactor the deposit code
        # total_due = registration.server_pricing_results['total']
        # if total != total_due:
        #     raise PaymentError(f'incorrect payment total {total} (amount due: {total_due})')

        # everything looks good
        registration.payment_set.create(
            payment_type=registration.payment_type,
            paid_on=timezone.now(),
            amount=pricing.money_fmt(total),
            paypal_order_details=order_details,
            notes=notes
        )


class SendInvitationView(APIView):
    permission_classes = [permissions.IsAdminUser]

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
    permission_classes = [permissions.IsAdminUser]

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
    permission_classes = [permissions.IsAdminUser]

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

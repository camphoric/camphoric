import logging
import re
from smtplib import SMTPException
import traceback

import cmarkgfm
import chevron
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.core.mail import EmailMultiAlternatives
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie

import jsonschema  # Using Draft-7
from rest_framework import permissions, status
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.serializers import ValidationError
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from camphoric import (
    models,
    pricing,
    serializers,
)
from camphoric.lodging import get_lodging_schema
from camphoric.mail import get_email_connection_for_event
from camphoric.paypal import PayPalClient
import camphoric.mail


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


class EventViewSet(ModelViewSet):
    queryset = models.Event.objects.all()
    serializer_class = serializers.EventSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['organization']


class RegistrationViewSet(ModelViewSet):
    queryset = models.Registration.objects.all()
    serializer_class = serializers.RegistrationSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['event']


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


class LodgingViewSet(ModelViewSet):
    queryset = models.Lodging.objects.all()
    serializer_class = serializers.LodgingSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['event']


class CamperViewSet(ModelViewSet):
    queryset = models.Camper.objects.all()
    serializer_class = serializers.CamperSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['registration']


class DepositViewSet(ModelViewSet):
    queryset = models.Deposit.objects.all()
    serializer_class = serializers.DepositSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['event']


class PaymentViewSet(ModelViewSet):
    queryset = models.Payment.objects.all()
    serializer_class = serializers.PaymentSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['registration']


class BulkEmailTaskViewSet(ModelViewSet):
    queryset = models.BulkEmailTask.objects.all()
    serializer_class = serializers.BulkEmailTaskSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['event']


class BulkEmailRecipientViewSet(ModelViewSet):
    queryset = models.BulkEmailRecipient.objects.all()
    serializer_class = serializers.BulkEmailRecipientSerializer
    permission_classes = [permissions.IsAdminUser]
    filterset_fields = ['task']


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
    def get(self, request):
        '''
        Return an array of objects with the following keys:
        - name: event name
        - url: url to the registration form for the event
        - open: whether registration is open for this event
        '''
        events = models.Event.objects.all()

        def map_event(event):
            return {
                'name': event.name,
                'url': f"/events/{event.id}/register",
                'open': event.is_open(),
            }
        response_data = list(map(map_event, events))
        return Response(response_data)


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
            'pricingLogic': {
                'camper': event.camper_pricing_logic or {},
                'registration': event.registration_pricing_logic or {},
            },
        }

        if event.paypal_enabled and event.paypal_client_id:
            response_data['payPalOptions'] = {
                'client-id': event.paypal_client_id,
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

        for camper in campers:
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
        registration = get_object_or_404(models.Registration, uuid=registration_uuid)

        payment_type = request.data.get('paymentType')
        if payment_type is None:
            raise ValidationError({'paymentType': 'This field is required'})
        if payment_type not in event.valid_payment_types:
            raise ValidationError({
                'paymentType': 'Invalid value: must be one of ' +
                               ', '.join(event.valid_payment_types)
            })

        registration.initial_payment = request.data.get('paymentData')
        registration.initial_payment['balance'] = (
            registration.server_pricing_results['total']
            - registration.initial_payment['total']
        )

        registration.payment_type = payment_type

        is_paypal_captured_payment = (
            payment_type == models.PaymentType.PAYPAL or
            payment_type == models.PaymentType.CARD
        )

        if is_paypal_captured_payment:
            paypal_response = request.data.get('payPalResponse')
            if paypal_response is None:
                raise ValidationError({'payPalResponse': 'This field is required.'})
            registration.paypal_response = paypal_response

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

        server_pricing_results = registration.server_pricing_results

        # TODO: rather than doing these one-off transformations, we should
        # probably be creating specific serializers for use in templates and
        # reports, see https://github.com/camphoric/camphoric/issues/262

        campers_template_value = []
        for camper_index, camper in enumerate(registration.campers.all()):
            campers_template_value.append({
                **camper.attributes,
                'pricing_result': server_pricing_results['campers'][camper_index],
                'lodging': (camper.lodging.name if camper.lodging else 'none'),
                'lodging_full': (camper.lodging.name_path if camper.lodging else 'none'),
            })

        confirmation_email_body_text = chevron.render(
            event.confirmation_email_template,
            {
                'registration': registration,
                'campers': campers_template_value,
                'pricing_results': server_pricing_results,
                'initial_payment': registration.initial_payment,
            })

        confirmation_email_body_html = cmarkgfm.github_flavored_markdown_to_html(
                confirmation_email_body_text
            )
        email_error = None
        sent = False
        try:
            if '@dontsend.com' in registration.registrant_email:
                email_error = 'registration email contains @dontsend.com'
                logger.error(confirmation_email_body_html)
            else:
                msg = EmailMultiAlternatives(
                    event.confirmation_email_subject,
                    confirmation_email_body_text,
                    event.confirmation_email_from,
                    [registration.registrant_email],
                    connection=get_email_connection_for_event(event),
                )
                msg.attach_alternative(confirmation_email_body_html, "text/html")
                sent = msg.send(fail_silently=False)

            if not sent:
                email_error = email_error or 'mail not sent'
        except SMTPException as e:
            email_error = str(e)

        if email_error:
            logger.error(f'error sending confirmation email: {email_error}')

        return Response({
            'confirmationPageTemplate': event.confirmation_page_template,
            'serverPricingResults': server_pricing_results,
            'emailError': bool(email_error),
            'initialPayment': registration.initial_payment,
        })

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

        ui_schema = {
            **event.registration_ui_schema,
            'campers': {
                **event.registration_ui_schema.get('campers', {}),
                'items': {
                    **event.registration_ui_schema.get('campers', {}).get('items', {}),
                    'lodging': {
                        **(event.registration_ui_schema
                           .get('campers', {})
                           .get('items', {})
                           .get('lodging', {})),
                        **(lodging_ui_schema or {}),
                    }
                },
            },
        }

        return schema, ui_schema

    @classmethod
    def validate_form_data(cls, event, form_data):
        (schema, _) = cls.get_form_schema(event)
        try:
            jsonschema.validate(form_data, schema)
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

        if invitation.registration:
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
            settings.PAYPAL_SECRET,
        )

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
            total += int(float(amount['value']))
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
            amount=total,
            paypal_order_details=order_details,
        )


class SendInvitationView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, invitation_id=None):
        '''
        - Takes an invitation
        - generates an email with a link to the registration form that will redeem that invitation
        - sends the email
        - sets the sent_time on the invitation
        '''
        invitation = get_object_or_404(models.Invitation, id=invitation_id)
        to_name = invitation.recipient_name
        to_email = invitation.recipient_email
        event = invitation.registration_type.event
        invitation_body_text = chevron.render(
            invitation.registration_type.invitation_email_template,
            {
                'recipient_name': to_name or to_email,
                'recipient_email': to_email,
                'invitation_code': invitation.invitation_code,
                'register_link': register_page_url(request, event.id, invitation)
            }
        )
        invitation_body_html = cmarkgfm.github_flavored_markdown_to_html(
                invitation_body_text
            )

        email_error = None
        sent = False
        try:
            if '@dontsend.com' in to_email:
                email_error = 'invitation email contains @dontsend.com'
                logger.error(invitation_body_html)
            else:
                msg = EmailMultiAlternatives(
                    invitation.registration_type.invitation_email_subject,
                    invitation_body_text,
                    event.confirmation_email_from,  # TODO: figure out what this should be
                    [f'"{to_name}" <{to_email}>' if to_name else to_email],
                    connection=get_email_connection_for_event(event),
                )
                msg.attach_alternative(invitation_body_html, "text/html")
                sent = msg.send(fail_silently=False)
                if not sent:
                    email_error = 'mail not sent'
        except SMTPException as e:
            email_error = str(e)

        if email_error:
            return Response(
                {"detail": email_error},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        invitation.sent_time = timezone.now()
        invitation.save()

        return Response({
            'success': True,
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


class SendBulkEmailView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, task_id=None):
        '''
        Run the given BulkEmailTask and return a response when the task is
        finished or canceled. Sending status can be checked via the
        /api/bulkemailtasks/$id and /api/bulkemailrecipients/?task=$id
        endpoints. See camphoric.mail.send_bulk_email for details.
        '''
        task = get_object_or_404(models.BulkEmailTask, id=task_id)
        camphoric.mail.send_bulk_email(task)

        return Response(serializers.BulkEmailTaskSerializer(task).data)


class CancelBulkEmailView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, task_id=None):
        '''
        Cancel the given BulkEmailTask. It can be resumed later via
        SendBulkEmailView.post.
        '''
        task = get_object_or_404(models.BulkEmailTask, id=task_id)
        camphoric.mail.cancel_bulk_email(task)

        return Response({'success': True})


def register_page_url(request, event_id, invitation=None):
    path = reverse('register', kwargs={'event_id': event_id})
    if invitation:
        query = f'?email={invitation.recipient_email}&code={invitation.invitation_code}'
    else:
        query = ''
    url = request.build_absolute_uri(path + query)

    # transform api url into frontend url
    url = re.sub(r':8000', ':3000', url, count=1)
    url = re.sub(r'/api/', '/', url, count=1)

    return url

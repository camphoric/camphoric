import logging
import re
from smtplib import SMTPException

import chevron
from django.core import mail
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
import jsonschema  # Using Draft-7
from rest_framework.serializers import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework import permissions, status

from camphoric import (
    models,
    pricing,
    serializers,
)


logger = logging.getLogger(__name__)


class OrganizationViewSet(ModelViewSet):
    queryset = models.Organization.objects.all()
    serializer_class = serializers.OrganizationSerializer
    permission_classes = [permissions.IsAdminUser]


class EventViewSet(ModelViewSet):
    queryset = models.Event.objects.all()
    serializer_class = serializers.EventSerializer
    permission_classes = [permissions.IsAdminUser]


class RegistrationViewSet(ModelViewSet):
    queryset = models.Registration.objects.all()
    serializer_class = serializers.RegistrationSerializer
    permission_classes = [permissions.IsAdminUser]


class RegistrationTypeViewSet(ModelViewSet):
    queryset = models.RegistrationType.objects.all()
    serializer_class = serializers.RegistrationTypeSerializer
    permission_classes = [permissions.IsAdminUser]


class InvitationViewSet(ModelViewSet):
    queryset = models.Invitation.objects.all()
    serializer_class = serializers.InvitationSerializer
    permission_classes = [permissions.IsAdminUser]


class LodgingViewSet(ModelViewSet):
    queryset = models.Lodging.objects.all()
    serializer_class = serializers.LodgingSerializer
    permission_classes = [permissions.IsAdminUser]


class CamperViewSet(ModelViewSet):
    queryset = models.Camper.objects.all()
    serializer_class = serializers.CamperSerializer
    permission_classes = [permissions.IsAdminUser]


class DepositViewSet(ModelViewSet):
    queryset = models.Deposit.objects.all()
    serializer_class = serializers.DepositSerializer
    permission_classes = [permissions.IsAdminUser]


class PaymentViewSet(ModelViewSet):
    queryset = models.Payment.objects.all()
    serializer_class = serializers.PaymentSerializer
    permission_classes = [permissions.IsAdminUser]


class InvitationError(Exception):
    def __init__(self, user_message):
        self.user_message = user_message


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

        response_data = {
            'dataSchema': self.get_form_schema(event),
            'uiSchema': event.registration_ui_schema or {},
            'event': pricing.get_event_attributes(event),
            'pricing': event.pricing or {},
            'pricingLogic': {
                'camper': event.camper_pricing_logic or {},
                'registration': event.registration_pricing_logic or {},
            },
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

        confirmation_email_body = chevron.render(
            event.confirmation_email_template,
            {
                'registration': registration.attributes,
                'campers': [camper.attributes for camper in campers],
                'pricing_results': server_pricing_results,
            })

        email_error = None
        try:
            sent = mail.send_mail(
                event.confirmation_email_subject,
                confirmation_email_body,
                event.confirmation_email_from,
                [registration.registrant_email],
                fail_silently=False)
            if not sent:
                email_error = 'mail not sent'
        except SMTPException as e:
            email_error = str(e)

        if email_error:
            logger.error(f'error sending confirmation email: {email_error}')

        return Response({
            'confirmationPageTemplate': event.confirmation_page_template,
            'serverPricingResults': server_pricing_results,
            'emailError': bool(email_error),
        })

    @classmethod
    def get_form_schema(cls, event):
        if not event.registration_schema:
            return None
        return {
            **event.registration_schema,
            'definitions': {
                **event.registration_schema.get('definitions', {}),
                'camper': event.camper_schema,
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
                **event.registration_schema['properties'],
                'campers': {
                    'type': 'array',
                    'minItems': 1,
                    'items': {
                        '$ref': '#/definitions/camper',
                    },
                },
            },
        }

    @classmethod
    def validate_form_data(cls, event, form_data):
        schema = cls.get_form_schema(event)
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
            models.Camper(registration=registration, attributes=camper_attributes)
            for camper_attributes in form_data['campers']
        ]
        return registration, campers

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
            raise InvitationError(f'Sorry, we couldn\'t find an invitation for "{email}" with code "{code}"')

        if invitation.registration:
            raise InvitationError('Sorry, that invitation code has already been redeemed')

        if invitation.expiration_time and invitation.expiration_time < timezone.now():
            raise InvitationError('Sorry, that invitation code has expired')

        return invitation


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
        invitation_body = chevron.render(
            invitation.registration_type.invitation_email_template,
            {
                'recipient_name': to_name or to_email,
                'recipient_email': to_email,
                'invitation_code': invitation.invitation_code,
                'register_link': register_page_url(request, event.id, invitation)
            }
        )
        
        email_error = None
        try:
            sent = mail.send_mail(
                invitation.registration_type.invitation_email_subject,
                invitation_body,
                event.confirmation_email_from, #TODO: figure out what this should be
                [f'"{to_name}" <{to_email}>' if to_name else to_email],
                fail_silently=False)
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

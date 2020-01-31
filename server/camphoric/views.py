from django.shortcuts import get_object_or_404
import jsonschema  # Using Draft-7
from rest_framework.serializers import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework import permissions

from camphoric import models
from camphoric import serializers


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
        event = models.Event.objects.get(id=event_id)
        return Response({
            'dataSchema': self.get_form_schema(event),
            'uiSchema': event.registration_ui_schema or {},
            'pricing': event.pricing or {},
            'pricingLogic': {
                'camper': event.camper_pricing_logic or {},
                'registration': event.registration_pricing_logic or {},
            },
        })

    def post(self, request, event_id=None, format=None):
        event = get_object_or_404(models.Event, id=event_id)
        form_data = request.data.get('formData')
        if not form_data:
            raise ValidationError({'formData': 'This field is required.'})
        self.validate_form_data(event, form_data)
        registration, campers = self.deserialize_form_data(
            event, form_data)
        # pricing gets called
        # email registrant and registrar
        registration.save()
        for camper in campers:
            camper.save()
        return Response({'success': True})

    @classmethod
    def get_form_schema(cls, event):
        if not event.registration_schema:
            return None
        return {
            **event.registration_schema,
            'definitions': {
                'camper': event.camper_schema,
            },
            'properties': {
                **event.registration_schema['properties'],
                'campers': {
                    'type': 'array',
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
        registration_data = {k: v for k, v in form_data.items() if k != 'campers'}
        registration = models.Registration(event=event, attributes=registration_data)
        campers = [
            models.Camper(registration=registration, attributes=camper_attributes)
            for camper_attributes in form_data['campers']
        ]
        return registration, campers

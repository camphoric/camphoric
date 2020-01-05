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
        event = models.Event.objects.get(id=event_id)
        return Response({
            'dataSchema': get_data_schema(event),
            'uiSchema': event.registration_ui_schema or {},
            'pricing': event.pricing or {},
            'pricingLogic': {
                'camper': event.camper_pricing_logic or {},
                'registration': event.registration_pricing_logic or {},
            },
        })


def get_data_schema(event):
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


def get_pricing_logic(event):
    pass

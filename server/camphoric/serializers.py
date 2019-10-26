from django.contrib.auth.models import User
from rest_framework.serializers import ModelSerializer

import camphoric.models


class OrganizationSerializer(ModelSerializer):
    class Meta:
        model = camphoric.models.Organization
        fields = '__all__'


class EventSerializer(ModelSerializer):
    class Meta:
        model = camphoric.models.Event
        fields = '__all__'


class RegistrationSerializer(ModelSerializer):
    class Meta:
        model = camphoric.models.Registration
        fields = '__all__'


class LodgingSerializer(ModelSerializer):
    class Meta:
        model = camphoric.models.Lodging
        fields = '__all__'


class CamperSerializer(ModelSerializer):
    class Meta:
        model = camphoric.models.Camper
        fields = '__all__'


class DepositSerializer(ModelSerializer):
    class Meta:
        model = camphoric.models.Deposit
        fields = '__all__'


class PaymentSerializer(ModelSerializer):
    class Meta:
        model = camphoric.models.Payment
        fields = '__all__'

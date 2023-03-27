import logging
from rest_framework.serializers import ModelSerializer, ValidationError
from django.contrib.auth.models import User
import jsonschema  # Using Draft-7
from camphoric import (
    models,
    pricing,
)

logger = logging.getLogger(__name__)


class OrganizationSerializer(ModelSerializer):
    class Meta:
        model = models.Organization
        fields = '__all__'


class EmailAccountSerializer(ModelSerializer):
    class Meta:
        model = models.EmailAccount
        fields = '__all__'
        extra_kwargs = {
            'password': {'write_only': True}
        }


class EventSerializer(ModelSerializer):
    class Meta:
        model = models.Event
        fields = '__all__'

    def validate_camper_schema(self, schema):
        return validate_schema(schema)

    def validate_payment_schema(self, schema):
        return validate_schema(schema)

    def validate_registration_schema(self, schema):
        return validate_schema(schema)

    def validate_lodging_schema(self, schema):
        return validate_schema(schema)


class RegistrationSerializer(ModelSerializer):
    class Meta:
        model = models.Registration
        fields = '__all__'

    def update(self, instance, validated_data):
        updated_instance = super().update(instance, validated_data)

        server_pricing_results = pricing.calculate_price(
            updated_instance,
            updated_instance.campers.all()
        )
        updated_instance.server_pricing_results = server_pricing_results
        updated_instance.save()

        return updated_instance

    def validate(self, data):
        if self.partial and 'event' not in data:
            return data

        return validate_attributes(data, data['event'].registration_schema)


class RegistrationTypeSerializer(ModelSerializer):
    class Meta:
        model = models.RegistrationType
        fields = '__all__'


class ReportSerializer(ModelSerializer):
    class Meta:
        model = models.Report
        fields = '__all__'


class InvitationSerializer(ModelSerializer):
    class Meta:
        model = models.Invitation
        fields = '__all__'


class LodgingSerializer(ModelSerializer):
    class Meta:
        model = models.Lodging
        fields = '__all__'


class CamperSerializer(ModelSerializer):
    class Meta:
        model = models.Camper
        fields = '__all__'

    def validate(self, data):
        if self.partial and 'registration' not in data:
            return data

        return validate_attributes(data, data['registration'].event.camper_schema)


class DepositSerializer(ModelSerializer):
    class Meta:
        model = models.Deposit
        fields = '__all__'


class PaymentSerializer(ModelSerializer):
    class Meta:
        model = models.Payment
        fields = '__all__'

    def validate(self, data):
        if self.partial and 'registration' not in data:
            return data

        return validate_attributes(data, data['registration'].event.payment_schema)


class BulkEmailTaskSerializer(ModelSerializer):
    class Meta:
        model = models.BulkEmailTask
        fields = '__all__'


class BulkEmailRecipientSerializer(ModelSerializer):
    class Meta:
        model = models.BulkEmailRecipient
        fields = '__all__'


class UserSerializer(ModelSerializer):
    class Meta:
        model = User
        exclude = ['password']

    def create(self, validated_data):
        kwargs = dict(validated_data)
        del kwargs['username']
        return User.objects.create_user(validated_data['username'], **kwargs)


def validate_schema(schema):
    try:
        jsonschema.Draft7Validator.check_schema(schema)
    except jsonschema.exceptions.SchemaError as e:
        raise ValidationError(e.message)
    return schema


def validate_attributes(data, schema):
    decoded_json = data['attributes']
    try:
        jsonschema.validate(decoded_json, schema)
    except jsonschema.exceptions.ValidationError as e:
        raise ValidationError({'attributes': e.message})
    return data

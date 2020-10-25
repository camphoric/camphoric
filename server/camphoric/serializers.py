from rest_framework.serializers import ModelSerializer, ValidationError
import jsonschema  # Using Draft-7

import camphoric.models


class OrganizationSerializer(ModelSerializer):
    class Meta:
        model = camphoric.models.Organization
        fields = '__all__'


class EventSerializer(ModelSerializer):
    class Meta:
        model = camphoric.models.Event
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
        model = camphoric.models.Registration
        fields = '__all__'

    def validate(self, data):
        return validate_attributes(data, data['event'].registration_schema)


class RegistrationTypeSerializer(ModelSerializer):
    class Meta:
        model = camphoric.models.RegistrationType
        fields = '__all__'


class InvitationSerializer(ModelSerializer):
    class Meta:
        model = camphoric.models.Invitation
        fields = '__all__'


class LodgingSerializer(ModelSerializer):
    class Meta:
        model = camphoric.models.Lodging
        fields = '__all__'


class CamperSerializer(ModelSerializer):
    class Meta:
        model = camphoric.models.Camper
        fields = '__all__'

    def validate(self, data):
        return validate_attributes(data, data['registration'].event.camper_schema)


class DepositSerializer(ModelSerializer):
    class Meta:
        model = camphoric.models.Deposit
        fields = '__all__'


class PaymentSerializer(ModelSerializer):
    class Meta:
        model = camphoric.models.Payment
        fields = '__all__'

    def validate(self, data):
        return validate_attributes(data, data['registration'].event.payment_schema)


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

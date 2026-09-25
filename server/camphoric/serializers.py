from rest_framework.serializers import ModelSerializer, ValidationError
from django.contrib.auth.models import User
import jsonschema  # Using Draft-7
from camphoric import (
    models,
)


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

    def validate_registration_error_messages(self, messages):
        return validate_error_messages(messages)


class RegistrationSerializer(ModelSerializer):
    class Meta:
        model = models.Registration
        fields = '__all__'

    def validate(self, data):
        if self.partial and 'event' not in data:
            return data

        return validate_attributes(data, data['event'].registration_schema)


class RegistrationTypeSerializer(ModelSerializer):
    class Meta:
        model = models.RegistrationType
        fields = '__all__'


class CustomChargeTypeSerializer(ModelSerializer):
    class Meta:
        model = models.CustomChargeType
        fields = '__all__'


class CustomChargeSerializer(ModelSerializer):
    class Meta:
        model = models.CustomCharge
        fields = '__all__'


class ReportSerializer(ModelSerializer):
    class Meta:
        model = models.Report
        fields = '__all__'

    def validate(self, data):
        output = data.get('output', getattr(self.instance, 'output', None))
        source = data.get('variables_source', getattr(self.instance, 'variables_source', None))
        if output == models.ReportOutputType.HANDLEBARS \
                and source == models.ReportVariablesSource.SERVER:
            raise ValidationError({
                'variables_source': 'Handlebars reports render in the browser, so they can '
                                    "only use the client's variables.",
            })
        return data


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


def validate_error_messages(messages):
    '''
    Check the shape of Event.registration_error_messages:
    { field path: { validation keyword: message } }, all non-empty strings.
    The messages are Handlebars templates; their syntax is checked by the
    client, which falls back to a built-in message if one fails to render.
    '''
    if messages is None:
        return {}
    if not isinstance(messages, dict):
        raise ValidationError(
            'must be an object mapping field paths to '
            '{ validation keyword: message } objects')
    for path, rules in messages.items():
        if not isinstance(path, str) or not path.strip():
            raise ValidationError('field paths must be non-empty strings')
        if not isinstance(rules, dict):
            raise ValidationError(
                f"'{path}' must map validation keywords to messages")
        for keyword, message in rules.items():
            if not isinstance(keyword, str) or not keyword.strip():
                raise ValidationError(
                    f"'{path}': validation keywords must be non-empty strings")
            if not isinstance(message, str) or not message.strip():
                raise ValidationError(
                    f"'{path}' / '{keyword}': the message must be a non-empty string")
    return messages


def validate_attributes(data, schema):
    decoded_json = data['attributes']
    try:
        jsonschema.validate(decoded_json, schema)
    except jsonschema.exceptions.ValidationError as e:
        raise ValidationError({'attributes': e.message})
    return data

from rest_framework.serializers import ModelSerializer, SerializerMethodField, ValidationError
from django.contrib.auth.models import User
import jsonschema  # Using Draft-7
from camphoric import (
    models,
)
from camphoric.templating.bulk import Criteria, expression_diagnostics
from camphoric.templating.render import syntax_error


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

    def validate_confirmation_page_template(self, template):
        '''The confirmation page is Jinja, rendered on the server: it must parse (DR-42).'''
        problem = syntax_error(template)
        if problem:
            raise ValidationError(f'Line {problem.line}: {problem.message}')
        return template

    def validate(self, data):
        return validate_jinja_email(
            self.instance, data, 'confirmation_email_engine',
            'confirmation_email_subject', 'confirmation_email_template')


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

    def validate(self, data):
        return validate_jinja_email(
            self.instance, data, 'invitation_email_engine',
            'invitation_email_subject', 'invitation_email_template')


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
    '''
    A bulk email, with its derived `status` (draft | running | finished |
    stopped | failed) and recipient counts. The run fields are set by sending,
    never by clients.
    '''
    status = SerializerMethodField()
    recipient_count = SerializerMethodField()
    sent_count = SerializerMethodField()
    error_count = SerializerMethodField()

    class Meta:
        model = models.BulkEmailTask
        fields = '__all__'
        read_only_fields = ['running_pid', 'run_uuid', 'run_start_time', 'run_finish_time',
                            'error']

    def get_status(self, task):
        if task.running_pid:
            return 'running'
        if task.error:
            return 'failed'
        if task.run_finish_time:
            return 'finished'
        if task.run_start_time:
            return 'stopped'
        return 'draft'

    def _counts(self, task):
        if not hasattr(task, '_recipient_counts'):
            rows = list(task.recipients.values_list('sent_time', 'error'))
            task._recipient_counts = (
                len(rows),
                sum(1 for sent, _ in rows if sent),
                sum(1 for sent, error in rows if error and not sent),
            )
        return task._recipient_counts

    def get_recipient_count(self, task):
        return self._counts(task)[0]

    def get_sent_count(self, task):
        return self._counts(task)[1]

    def get_error_count(self, task):
        return self._counts(task)[2]

    def validate(self, data):
        errors = {}
        try:
            validate_jinja_email(self.instance, data, 'engine', 'subject', 'body_template')
        except ValidationError as exc:
            errors.update(exc.detail)
        merged = {name: data.get(name, getattr(self.instance, name, None))
                  for name in ('recipient_kind', 'recipient_list', 'recipient_filter',
                               'address_expression', 'name_expression', 'include_incomplete')}
        for problem in expression_diagnostics(Criteria.from_data(merged)):
            errors[problem.field] = [problem.message]
        if errors:
            raise ValidationError(errors)
        return data


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


def validate_jinja_email(instance, data, engine_field, subject_field, template_field):
    '''
    A Jinja email template must parse before it's saved (SPEC §8.3, §8.4), so a
    typo can't stop emails going out; mistakes that only show when rendering
    are the preview's job. Mustache templates aren't checked.
    '''
    def current(name):
        return data[name] if name in data else getattr(instance, name, None)

    if current(engine_field) != models.TemplateEngine.JINJA:
        return data
    errors = {}
    for name, field in ((subject_field, 'subject'), (template_field, 'template')):
        problem = syntax_error(current(name), field=field)
        if problem:
            errors[name] = [f'Line {problem.line}: {problem.message}']
    if errors:
        raise ValidationError(errors)
    return data

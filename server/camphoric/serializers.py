from rest_framework.serializers import (
    CharField, ModelSerializer, SerializerMethodField, ValidationError,
)
from django.contrib.auth.models import User
import jsonschema  # Using Draft-7
from camphoric import (
    models,
)
from camphoric.templating.bulk import Criteria, expression_diagnostics
from camphoric.templating.rules import compile_rules
from camphoric.templating.render import syntax_error


class OrganizationSerializer(ModelSerializer):
    class Meta:
        model = models.Organization
        fields = '__all__'


class EmailAccountSerializer(ModelSerializer):
    # 'set', 'unset', or 'unreadable' (stored, but the encryption key changed).
    password_status = SerializerMethodField()

    class Meta:
        model = models.EmailAccount
        fields = '__all__'
        extra_kwargs = {
            # Write-only; leaving it blank on an update keeps the stored password.
            'password': {'write_only': True, 'required': False, 'allow_blank': True},
        }

    def get_password_status(self, account):
        if account.password is None:
            return 'unreadable'
        return 'set' if account.password else 'unset'

    def update(self, instance, validated_data):
        if not validated_data.get('password'):
            validated_data.pop('password', None)
        return super().update(instance, validated_data)


class EmailMessageSerializer(ModelSerializer):
    '''A message in the email history, without its content.'''
    account_name = CharField(source='account.name', read_only=True, default=None)
    created_by_name = CharField(source='created_by.username', read_only=True, default=None)

    class Meta:
        model = models.EmailMessage
        exclude = ['text', 'html', 'dedupe_key', 'lease_until', 'deleted_at']


class EmailMessageDetailSerializer(EmailMessageSerializer):
    '''A message with the content that was sent.'''
    class Meta(EmailMessageSerializer.Meta):
        exclude = ['dedupe_key', 'lease_until', 'deleted_at']


class EventSerializer(ModelSerializer):
    class Meta:
        model = models.Event
        fields = '__all__'
        # Created with the event; edited as an email template.
        read_only_fields = ['confirmation_template']

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
        # Created with the type; edited as an email template.
        read_only_fields = ['invitation_template']


class EmailTemplateSerializer(ModelSerializer):
    class Meta:
        model = models.EmailTemplate
        fields = '__all__'

    def validate(self, data):
        errors = {}
        for name, field in (('subject', 'subject'), ('body', 'template')):
            if name in data:
                problem = syntax_error(data[name], field=field)
                if problem:
                    errors[name] = [f'Line {problem.line}: {problem.message}']
        purpose = data.get('purpose', getattr(self.instance, 'purpose', None))
        if purpose == models.EmailTemplatePurpose.GROUP:
            errors.update(self.audience_errors(data))
        instance = self.instance
        if instance is None and data.get('purpose') != models.EmailTemplatePurpose.GROUP:
            # The confirmation and invitations come with their event and types.
            errors['purpose'] = ['Only group email templates can be created.']
        if instance is not None:
            for name in ('purpose', 'event'):
                if name in data and data[name] != getattr(instance, name):
                    errors[name] = ["A template's purpose and event can't be changed."]
        if errors:
            raise ValidationError(errors)
        return data

    def audience_errors(self, data):
        '''A group email's recipient rules and expressions must make sense before it's saved.'''
        def current(name):
            return data[name] if name in data else getattr(self.instance, name, None)

        errors = {}
        _, problems = compile_rules(current('filter'))
        if problems:
            errors['filter'] = [p.message for p in problems]
        criteria = Criteria(
            recipient_filter=current('filter_expression') or '',
            address_expression=current('address_expression') or '',
            name_expression=current('name_expression') or '')
        for problem in expression_diagnostics(criteria):
            name = {'recipient_filter': 'filter_expression'}.get(problem.field, problem.field)
            errors[name] = [f'Line {problem.line}: {problem.message}' if problem.line
                            else problem.message]
        return errors


COUNT_FILTERS = {
    'total': {},
    'sent': {'status': models.EmailMessageStatus.SENT},
    'failed': {'status': models.EmailMessageStatus.FAILED},
    'cancelled': {'status': models.EmailMessageStatus.CANCELLED},
    'waiting': {'status__in': [models.EmailMessageStatus.QUEUED,
                               models.EmailMessageStatus.SENDING]},
}


class EmailBatchSerializer(ModelSerializer):
    '''One send of a group email, with its messages' counts.'''
    total = SerializerMethodField()
    sent = SerializerMethodField()
    failed = SerializerMethodField()
    cancelled = SerializerMethodField()
    waiting = SerializerMethodField()
    # scheduled | preparing | sending | done | cancelled (done: sending, nothing waiting).
    state = SerializerMethodField()
    created_by_name = CharField(source='created_by.username', read_only=True, default=None)

    class Meta:
        model = models.EmailBatch
        exclude = ['deleted_at']

    @staticmethod
    def _count(batch, name):
        # Annotated by batches.with_counts in lists; counted for a single batch.
        if hasattr(batch, name):
            return getattr(batch, name)
        return batch.messages.filter(**COUNT_FILTERS[name]).count()

    def get_total(self, batch):
        return self._count(batch, 'total')

    def get_sent(self, batch):
        return self._count(batch, 'sent')

    def get_failed(self, batch):
        return self._count(batch, 'failed')

    def get_cancelled(self, batch):
        return self._count(batch, 'cancelled')

    def get_waiting(self, batch):
        return self._count(batch, 'waiting')

    def get_state(self, batch):
        if batch.status == models.EmailBatchStatus.SENDING and not self.get_waiting(batch):
            return 'done'
        return {models.EmailBatchStatus.EXPANDING: 'preparing'}.get(batch.status, batch.status)


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
    # The latest invitation email's delivery: its status and error (null: never sent).
    email = SerializerMethodField()

    class Meta:
        model = models.Invitation
        fields = '__all__'

    def get_email(self, invitation):
        message = (models.EmailMessage.objects.filter(invitation=invitation)
                   .order_by('-created_at', '-id').first())
        if message is None:
            return None
        return {'id': message.id, 'status': message.status, 'error': message.last_error,
                'queued_at': message.created_at, 'sent_at': message.sent_at}


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

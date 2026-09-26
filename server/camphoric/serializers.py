from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.serializers import (
    BooleanField, CharField, ChoiceField, ModelSerializer, SerializerMethodField,
    ValidationError,
)
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
import jsonschema  # Using Draft-7
from camphoric import (
    accounts,
    models,
    roles,
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
        exclude = ['text', 'html', 'dedupe_key', 'lease_until', 'unsubscribe_url',
                   'deleted_at']


class EmailMessageDetailSerializer(EmailMessageSerializer):
    '''A message with the content that was sent.'''
    class Meta(EmailMessageSerializer.Meta):
        exclude = ['dedupe_key', 'lease_until', 'unsubscribe_url', 'deleted_at']


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


class EmailUnsubscribeSerializer(ModelSerializer):
    '''An address unsubscribed from an event's group email (SPEC DR-48).'''
    created_by_name = CharField(source='created_by.username', read_only=True, default=None)

    class Meta:
        model = models.EmailUnsubscribe
        fields = ['id', 'event', 'email', 'source', 'created_by', 'created_by_name',
                  'created_at']
        read_only_fields = ['source', 'created_by', 'created_at']
        # The duplicate check is in validate, on the normalized address.
        validators = []

    def validate(self, data):
        data['email'] = data['email'].strip().lower()
        if models.EmailUnsubscribe.objects.filter(event=data['event'],
                                                  email=data['email']).exists():
            raise ValidationError({'email': ['This address is already unsubscribed.']})
        return data


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


class CurrentUserSerializer(ModelSerializer):
    '''The signed-in user (GET /api/user), with their Camphoric permission group.'''
    role = SerializerMethodField()

    must_change_password = SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff',
                  'is_superuser', 'is_active', 'last_login', 'date_joined', 'role',
                  'must_change_password']

    def get_role(self, user):
        return roles.role_of(user)

    def get_must_change_password(self, user):
        return accounts.must_change_password(user)


class Conflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = 'conflict'


def password_problems(password, user):
    '''Django's password validators' messages for `password`, or [] if it's fine.'''
    try:
        validate_password(password, user)
    except DjangoValidationError as error:
        return list(error.messages)
    return []


class ManagedUserSerializer(ModelSerializer):
    '''
    A user as Admins manage them (/api/users/, SPEC DR-50, DR-52): their
    Camphoric permission group (`role`) and, for superusers only, their Django
    access. Group membership and Django's flags can't be written directly.

    Guard rails: nobody changes their own role or Django access, or deactivates
    themselves (so there's always an active Admin). A superuser is always an
    Admin; to change their group, change their Django access first.
    '''
    role = ChoiceField(choices=roles.ROLES, allow_null=True, required=False)
    django_access = ChoiceField(choices=roles.DJANGO_ACCESS, required=False)
    has_password = SerializerMethodField()
    # Creating: email a set-password link (the default), or — superusers only —
    # set a password now, to be changed at the next sign-in if `require_change`.
    send_password_link = BooleanField(write_only=True, required=False, default=True)
    password = CharField(write_only=True, required=False, trim_whitespace=False)
    require_change = BooleanField(write_only=True, required=False, default=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role',
                  'django_access', 'is_active', 'last_login', 'date_joined', 'has_password',
                  'send_password_link', 'password', 'require_change']
        read_only_fields = ['last_login', 'date_joined']
        extra_kwargs = {'email': {'required': True, 'allow_blank': False}}

    @property
    def _actor(self):
        return self.context['request'].user

    def get_has_password(self, user):
        return user.has_usable_password()

    def to_representation(self, user):
        data = super().to_representation(user)
        data['role'] = roles.assigned_role(user)
        if self._actor.is_superuser:
            data['django_access'] = roles.django_access_of(user)
        else:
            data.pop('django_access', None)
        return data

    def validate_email(self, value):
        value = value.strip()
        others = User.objects.filter(email__iexact=value)
        if self.instance is not None:
            others = others.exclude(pk=self.instance.pk)
        if others.exists():
            raise ValidationError('Another user already has this email address.')
        return value

    def validate(self, attrs):
        if not self._actor.is_superuser:
            # Only superusers see or change Django access and set passwords.
            for name in ('django_access', 'password', 'require_change'):
                attrs.pop(name, None)
        user = self.instance
        if user is None:
            if 'role' not in attrs:
                raise ValidationError({'role': ['Choose a Camphoric permission group.']})
            password = attrs.get('password')
            if password:
                candidate = User(username=attrs.get('username', ''), email=attrs.get('email', ''),
                                 first_name=attrs.get('first_name', ''),
                                 last_name=attrs.get('last_name', ''))
                problems = password_problems(password, candidate)
                if problems:
                    raise ValidationError({'password': problems})
            return attrs

        # Passwords are set with the set-password action, not by editing.
        for name in ('password', 'require_change', 'send_password_link'):
            attrs.pop(name, None)
        if user.pk == self._actor.pk:
            if 'role' in attrs and attrs['role'] != roles.assigned_role(user):
                raise Conflict('You can\'t change your own Camphoric permission group.')
            if 'django_access' in attrs and attrs['django_access'] != roles.django_access_of(user):
                raise Conflict('You can\'t change your own Django access.')
            if attrs.get('is_active') is False:
                raise Conflict('You can\'t deactivate your own account.')
        access = attrs.get('django_access', roles.django_access_of(user))
        if access == roles.SUPERUSER and attrs.get('role', roles.ADMIN) != roles.ADMIN:
            raise ValidationError({'role': [
                'A superuser is always an Admin; change their Django access first.']})
        return attrs

    def create(self, validated_data):
        role = validated_data.pop('role')
        access = validated_data.pop('django_access', roles.REGULAR)
        password = validated_data.pop('password', None)
        require_change = validated_data.pop('require_change', True)
        send_link = validated_data.pop('send_password_link', True)
        username = validated_data.pop('username')
        user = User.objects.create_user(username, password=None, **validated_data)
        roles.set_role(user, role)
        if access != roles.REGULAR:
            roles.set_django_access(user, access)
        if password:
            accounts.set_password(user, password, must_change=require_change)
        # The view emails the link once the user exists.
        user._send_password_link = bool(send_link and not password)
        return user

    def update(self, user, validated_data):
        role_given = 'role' in validated_data
        role = validated_data.pop('role', None)
        access = validated_data.pop('django_access', None)
        user = super().update(user, validated_data)
        if access is not None and access != roles.django_access_of(user):
            roles.set_django_access(user, access)
        if role_given and not user.is_superuser:
            roles.set_role(user, role)
        return user


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

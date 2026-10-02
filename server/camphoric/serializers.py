from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.serializers import (
    BooleanField, CharField, ChoiceField, DecimalField, ListSerializer,
    ModelSerializer as BaseModelSerializer, PrimaryKeyRelatedField, SerializerMethodField,
    ValidationError,
)
from django.contrib.auth.models import User
from django.db import transaction
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
import jsonschema  # Using Draft-7
from camphoric import (
    accounts,
    invoices,
    models,
    pricing,
    roles,
)
from camphoric.templating.bulk import Criteria, expression_diagnostics
from camphoric.templating.urls import register_url
from camphoric.templating.rules import compile_rules
from camphoric.templating.render import syntax_error


class ModelSerializer(BaseModelSerializer):
    '''
    DRF's, except that `deleted_at` is never written: deleting and restoring go
    through their own endpoints (SPEC DR-55).
    '''

    def get_extra_kwargs(self):
        extra_kwargs = super().get_extra_kwargs()
        extra_kwargs['deleted_at'] = {**extra_kwargs.get('deleted_at', {}), 'read_only': True}
        return extra_kwargs


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

    def validate_camper_pricing_logic(self, logic):
        return validate_pricing_logic(logic)

    def validate_registration_pricing_logic(self, logic):
        return validate_pricing_logic(logic)

    def validate_confirmation_page_template(self, template):
        '''The confirmation page is Jinja, rendered on the server: it must parse (DR-42).'''
        problem = syntax_error(template)
        if problem:
            raise ValidationError(f'Line {problem.line}: {problem.message}')
        return template


class RegistrationListSerializer(ListSerializer):
    '''Works out every listed registration's ledger at once (two queries, not two each).'''

    def to_representation(self, data):
        items = list(data.all() if hasattr(data, 'all') else data)
        self.child.context['ledgers'] = invoices.ledgers(items)
        return super().to_representation(items)


# The registration's money, worked out from its price, invoices and payments
# (SPEC §9.7): read-only numbers.
LEDGER_FIELDS = ('total_owed', 'total_paid', 'balance', 'handling_charges', 'uninvoiced_balance')


class RegistrationSerializer(ModelSerializer):
    # A deleted promo code stays on the registrations that have it (SPEC DR-67).
    promo_code = PrimaryKeyRelatedField(
        queryset=models.PromoCode.all_objects.all(), allow_null=True, required=False)
    # The code itself, so its discount line can be labelled even once it's deleted.
    promo = SerializerMethodField()

    class Meta:
        model = models.Registration
        fields = '__all__'
        read_only_fields = ['completed_at', 'confirmation_sent_at']
        list_serializer_class = RegistrationListSerializer

    def to_representation(self, registration):
        data = super().to_representation(registration)
        ledger = (self.context.get('ledgers') or {}).get(registration.id) \
            or invoices.ledger(registration)
        data.update({name: float(getattr(ledger, name)) for name in LEDGER_FIELDS})
        return data

    def get_promo(self, registration):
        promo_code = registration.promo_code
        if promo_code is None:
            return None
        return {
            'id': promo_code.id,
            'code': promo_code.code,
            'label': promo_code.label,
            'scope': promo_code.scope,
            'deleted': promo_code.deleted_at is not None,
        }

    def validate_promo_code(self, promo_code):
        # A registrar may give any live code, usable by registrants or not.
        unchanged = self.instance is not None and promo_code is not None and (
            self.instance.promo_code_id == promo_code.id)
        if promo_code is not None and promo_code.deleted_at is not None and not unchanged:
            raise ValidationError('This promo code has been deleted.')
        return promo_code

    def validate(self, data):
        event = data.get('event') or getattr(self.instance, 'event', None)
        promo_code = data.get('promo_code')
        if promo_code is not None and event is not None and promo_code.event_id != event.id:
            raise ValidationError({'promo_code': 'This promo code is for another event.'})

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


class PromoCodeSerializer(ModelSerializer):
    class Meta:
        model = models.PromoCode
        fields = '__all__'

    def validate_code(self, code):
        code = code.strip()
        if not code:
            raise ValidationError('This field may not be blank.')
        return code

    def validate(self, data):
        event = data.get('event') or getattr(self.instance, 'event', None)
        code = data.get('code')
        if code is not None and event is not None:
            others = models.PromoCode.objects.filter(event=event, code__iexact=code)
            if self.instance is not None:
                others = others.exclude(pk=self.instance.pk)
            if others.exists():
                raise ValidationError({'code': 'Another promo code already uses this code.'})
        return data


class CustomChargeTypeSerializer(ModelSerializer):
    class Meta:
        model = models.CustomChargeType
        fields = '__all__'


class CustomChargeSerializer(ModelSerializer):
    class Meta:
        model = models.CustomCharge
        fields = '__all__'


class PricingOverrideSerializer(ModelSerializer):
    '''
    A registrar's amount for one price line (SPEC DR-56). For a camper's line the
    registration is the camper's. `applied` says whether it's in effect: the event's
    pricing still has that line.
    '''
    registration = PrimaryKeyRelatedField(
        queryset=models.Registration.objects.all(), required=False)
    created_by_name = SerializerMethodField()
    applied = SerializerMethodField()

    class Meta:
        model = models.PricingOverride
        fields = ['id', 'registration', 'camper', 'var', 'amount', 'reason', 'created_by',
                  'created_by_name', 'applied', 'created_at', 'updated_at']
        read_only_fields = ['created_by', 'created_at', 'updated_at']
        # One per line is checked in validate(): DRF's own check would require
        # `registration` even for a camper's line.
        validators = []

    def get_created_by_name(self, override):
        user = override.created_by
        return (user.get_full_name() or user.username) if user else None

    def get_applied(self, override):
        return override.var in pricing.overridable_lines(
            override.registration.event, camper=override.camper_id is not None)

    def validate(self, data):
        instance = self.instance
        camper = data['camper'] if 'camper' in data else getattr(instance, 'camper', None)
        registration = data.get('registration') or getattr(instance, 'registration', None)
        if camper is not None:
            if registration is not None and registration != camper.registration:
                raise ValidationError({'camper': 'That camper is on another registration.'})
            registration = camper.registration
        if registration is None:
            raise ValidationError({'registration': 'This field is required.'})

        var = data.get('var', getattr(instance, 'var', None))
        if var == 'total':
            raise ValidationError(
                {'var': 'The total can’t be overridden; override one of its lines.'})
        if var not in pricing.overridable_lines(registration.event, camper=camper is not None):
            raise ValidationError({'var': f'This event’s pricing has no “{var}” line here.'})
        same_line = models.PricingOverride.objects.filter(
            registration=registration, camper=camper, var=var)
        if instance is not None:
            same_line = same_line.exclude(pk=instance.pk)
        if same_line.exists():
            raise ValidationError({'var': 'This line already has an override; change that one.'})
        return {**data, 'registration': registration}


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
    # Redeemed by a registration that's since been deleted (it still counts as redeemed).
    registration_deleted = SerializerMethodField()
    # The registration page with this invitation's code, for an organizer to copy
    # (to register someone themselves, or send it another way).
    register_link = SerializerMethodField()

    class Meta:
        model = models.Invitation
        fields = '__all__'

    def get_register_link(self, invitation):
        registration_type = invitation.registration_type
        if registration_type is None:
            return ''
        return register_url(registration_type.event_id, invitation, self.context.get('request'))

    def get_registration_deleted(self, invitation):
        registration = invitation.registration
        return registration is not None and registration.deleted_at is not None

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

        event = data['registration'].event
        return validate_attributes(data, camper_schema_with_definitions(event))


def camper_schema_with_definitions(event):
    '''
    The camper schema, able to resolve its `$ref`s: they point at the registration
    schema's shared definitions (the registration form validates campers inside it).
    '''
    camper_schema = event.camper_schema or {}
    definitions = {
        **(event.registration_schema or {}).get('definitions', {}),
        **camper_schema.get('definitions', {}),
    }
    return {**camper_schema, 'definitions': definitions} if definitions else camper_schema


class DepositSerializer(ModelSerializer):
    class Meta:
        model = models.Deposit
        fields = '__all__'


class InvoiceSerializer(ModelSerializer):
    '''
    An invoice (SPEC §9.7): what it asks, what's been paid on it, and its status,
    worked out from its payments. Any role reads it, notes included; Registrars
    and Admins change its description, amount, handling fee, memo, notes and
    due date. Its link code is never shown here.
    '''
    total = DecimalField(max_digits=9, decimal_places=2, read_only=True)
    amount_paid = DecimalField(max_digits=9, decimal_places=2, read_only=True)
    amount_due = DecimalField(max_digits=9, decimal_places=2, read_only=True)
    overpaid = DecimalField(max_digits=9, decimal_places=2, read_only=True)
    status = CharField(read_only=True)
    payments = PrimaryKeyRelatedField(many=True, read_only=True)
    created_by_name = SerializerMethodField()

    class Meta:
        model = models.Invoice
        exclude = ['token']
        read_only_fields = ['registration', 'origin', 'payment_type', 'pending_paypal_order_id',
                            'cancelled_at', 'cancel_reason', 'created_by', 'created_at',
                            'updated_at']

    def get_created_by_name(self, invoice):
        user = invoice.created_by
        return (user.get_full_name() or user.username) if user else None

    def validate_amount(self, amount):
        if amount < 0:
            raise ValidationError('An invoice can\'t ask for less than nothing.')
        return amount

    def validate_handling(self, handling):
        if handling < 0:
            raise ValidationError('The handling fee can\'t be negative.')
        return handling


class PaymentSerializer(ModelSerializer):
    '''
    A payment, or a refund (a negative amount, SPEC DR-94). Every payment
    belongs to an invoice (DR-87): given none, it goes on the registration's
    oldest invoice with money due, or a new "Payment received" invoice
    (`new_invoice` asks for that directly). A refund names the payment it
    gives money back from, or at least its invoice.
    '''
    registration = PrimaryKeyRelatedField(
        queryset=models.Registration.objects.all(), required=False)
    invoice = PrimaryKeyRelatedField(queryset=models.Invoice.objects.all(), required=False)
    refund_of = PrimaryKeyRelatedField(
        queryset=models.Payment.objects.all(), required=False, allow_null=True)
    new_invoice = BooleanField(write_only=True, required=False, default=False)
    refunded = SerializerMethodField()
    paypal_refundable = SerializerMethodField()

    class Meta:
        model = models.Payment
        fields = '__all__'
        read_only_fields = ['paypal_response', 'paypal_transaction_id']

    def get_refunded(self, payment):
        if payment.amount <= 0:
            return '0.00'
        return f'{invoices.money(payment.amount) - invoices.refundable(payment):.2f}'

    def get_paypal_refundable(self, payment):
        return (payment.amount > 0 and payment.payment_type in invoices.ONLINE_TYPES
                and bool(invoices.capture_id_of(payment))
                and invoices.refundable(payment) > 0)

    def validate(self, data):
        instance = self.instance
        current = (lambda name: data[name] if name in data else getattr(instance, name, None))
        amount = invoices.money(current('amount'))
        invoice = current('invoice')
        refund_of = current('refund_of')
        registration = (data.get('registration') or (invoice.registration if invoice else None)
                        or (refund_of.registration if refund_of else None)
                        or getattr(instance, 'registration', None))
        if registration is None:
            raise ValidationError({'registration': 'This field is required.'})
        if invoice is not None and invoice.registration_id != registration.id:
            raise ValidationError({'invoice': 'That invoice is on another registration.'})

        if refund_of is not None:
            if amount >= 0:
                raise ValidationError({'amount': 'A refund\'s amount is negative.'})
            if refund_of.amount <= 0:
                raise ValidationError({'refund_of': 'Only a payment can be refunded.'})
            if refund_of.registration_id != registration.id:
                raise ValidationError({'refund_of': 'That payment is on another registration.'})
            if invoice is None:
                invoice = refund_of.invoice
            elif invoice.id != refund_of.invoice_id:
                raise ValidationError(
                    {'invoice': 'A refund goes on the invoice of the payment it refunds.'})
            limit = invoices.refundable(refund_of)
            if instance is not None and instance.refund_of_id == refund_of.id:
                limit -= invoices.money(instance.amount)
            if -amount > limit:
                raise ValidationError(
                    {'amount': f'You can refund up to ${limit:.2f} of that payment.'})
        if amount < 0 and invoice is None:
            raise ValidationError({'invoice': 'A refund must name its invoice.'})
        moving_to = invoice is not None and (instance is None or instance.invoice_id != invoice.id)
        if moving_to and invoice.cancelled_at is not None:
            raise ValidationError({'invoice': 'That invoice is cancelled.'})

        if not self.partial or 'attributes' in data:
            validate_attributes({'attributes': data.get('attributes')},
                                registration.event.payment_schema)
        data['registration'] = registration
        if invoice is not None:
            data['invoice'] = invoice
        return data

    def create(self, validated_data):
        new_invoice = validated_data.pop('new_invoice', False)
        with transaction.atomic():
            if validated_data.get('invoice') is None:
                request = self.context.get('request')
                validated_data['invoice'] = invoices.invoice_for_payment(
                    validated_data['registration'], validated_data.get('amount'),
                    validated_data.get('payment_type', models.PaymentType.CHECK),
                    new_invoice=new_invoice, user=getattr(request, 'user', None))
            payment = super().create(validated_data)
            invoices.match_received_invoice(payment.invoice)
        return payment

    def update(self, instance, validated_data):
        validated_data.pop('new_invoice', None)
        with transaction.atomic():
            old_invoice = instance.invoice
            payment = super().update(instance, validated_data)
            invoices.match_received_invoice(old_invoice)
            if payment.invoice_id != old_invoice.id:
                invoices.match_received_invoice(payment.invoice)
        return payment


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


def validate_pricing_logic(logic):
    '''
    Check the shape of Event.camper_pricing_logic / registration_pricing_logic:
    a list of { "var", "exp" } components, one of them the `total` (SPEC DR-69),
    which pricing, promo codes, payments and reports all rely on.
    '''
    if not isinstance(logic, list):
        raise ValidationError('must be a list of { "var", "exp" } components')
    for component in logic:
        if not isinstance(component, dict) or not isinstance(component.get('var'), str) \
                or 'exp' not in component:
            raise ValidationError('each component must be an object with a "var" and an "exp"')
    if not any(component['var'] == 'total' for component in logic):
        raise ValidationError('must have a component whose "var" is "total"')
    return logic


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
    decoded_json = data.get('attributes')
    try:
        # Draft 7, as the forms validate in the browser (see
        # RegisterView.validate_form_data).
        jsonschema.Draft7Validator(schema).validate(decoded_json)
    except jsonschema.exceptions.ValidationError as e:
        raise ValidationError({'attributes': e.message})
    return data

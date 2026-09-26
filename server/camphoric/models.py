from decimal import Decimal
import datetime
import logging
import random
import uuid

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.utils import timezone
from camphoric import (
    crypto,
    pricing,
)

logger = logging.getLogger(__name__)

# Useful docs:
# - https://docs.djangoproject.com/en/4.1/ref/models/fields/


class CustomJSONField(models.JSONField):
    def __init__(self, *args, **kwargs):
        kwargs["encoder"] = DjangoJSONEncoder
        super().__init__(*args, **kwargs)


class EncryptedTextField(models.TextField):
    '''
    Text stored encrypted (camphoric.crypto) and read back as plaintext. A value
    that no configured key can decrypt reads back as None.
    '''

    def from_db_value(self, value, expression, connection):
        if value is None:
            return value
        try:
            return crypto.decrypt(value)
        except crypto.InvalidToken:
            logger.error(f'{self.model.__name__}.{self.name} can\'t be decrypted with the '
                         'configured CAMPHORIC_SECRET_KEY_EMAIL / SECRET_KEY')
            return None

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if not value or crypto.is_encrypted(value):
            return value
        return crypto.encrypt(value)


class PaymentType(models.TextChoices):
    CHECK = 'Check', 'Check'
    PAYPAL = 'PayPal', 'PayPal'
    CARD = 'Card', 'Debit or Credit Card'
    VOUCHER = 'Voucher', 'Discount or Gifted Credit'


class ReportOutputType(models.TextChoices):
    HTML = 'html', 'Jinja to HTML'
    MARKDOWN = 'md', 'Jinja to Markdown'
    CSV = 'csv', 'Jinja to CSV'
    HANDLEBARS = 'hbs', 'Handlebars to Markdown'
    PLAINTEXT = 'txt', 'Jinja to Plain Text'


class ReportVariablesSource(models.TextChoices):
    CLIENT = 'client', 'Client bundle (legacy)'
    SERVER = 'server', 'Camphoric variables'


class TimeStampedModel(models.Model):
    '''
    - Base class for most models.
    - Updates creation and modification time stamps automatically.
    - Allows soft delete.
    '''
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True)

    class Meta:
        abstract = True

    def soft_delete(self):
        self.deleted_at = timezone.now()
        self.save()

    def soft_undelete(self):
        self.deleted_at = None
        self.save()


class Organization(TimeStampedModel):
    '''
    - Is owned by many Users
    - Has many Events
    '''
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name


class EmailAccount(TimeStampedModel):
    '''
    Settings for an email account used to send registration confirmations,
    invitations, etc.
    '''
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    name = models.CharField(
        max_length=255,
        help_text="A unique name for this account"
    )
    backend = models.CharField(
        max_length=255,
        help_text="the Django email backend to use",
        default='django.core.mail.backends.smtp.EmailBackend',
        choices=[
            ('django.core.mail.backends.smtp.EmailBackend', 'SMTP'),
            ('django.core.mail.backends.console.EmailBackend', 'Console'),
        ],
    )
    host = models.CharField(max_length=255)
    port = models.PositiveIntegerField()
    security = models.CharField(
        max_length=10,
        choices=[
            ('starttls', 'STARTTLS (usually port 587)'),
            ('ssl', 'SSL/TLS (usually port 465)'),
            ('none', 'None'),
        ],
        default='starttls',
    )
    timeout = models.PositiveIntegerField(default=30, help_text='Seconds to wait for the server')
    username = models.CharField(max_length=255, blank=True)
    password = EncryptedTextField(blank=True, help_text='Stored encrypted')
    max_per_minute = models.PositiveIntegerField(
        null=True, blank=True, help_text='Most messages to send in any minute (blank: no limit)')
    max_per_day = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Most messages to send in any 24 hours (blank: no limit). '
                  'Gmail allows about 500 for personal accounts and 2,000 for Workspace.')
    default_reply_to = models.EmailField(blank=True)

    def __str__(self):
        return self.name

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'name'],
                name='email_account_name',
            ),
        ]


class Event(TimeStampedModel):
    '''
    - Is owned by one Organization
    - Has many Registrations

    Many models associated with an event have an `attributes` JSON field. The
    Event model defines the JSON schemas for those fields in the various
    *_schema fields.

    Pricing for an event is determined by the `pricing`,
    `registration_pricing_logic`, and `camper_pricing_logic` fields.
    See camphoric.views.RegisterView for more info.
    '''
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    registration_start = models.DateField(null=True)
    registration_end = models.DateField(null=True)
    start = models.DateField(null=True)
    end = models.DateField(null=True)
    default_stay_length = models.SmallIntegerField(
        default=1,
        help_text="The number of days that a camper stays by default")
    camper_schema = CustomJSONField(default=dict, help_text="JSON schema for Camper.attributes")
    camper_admin_schema = CustomJSONField(
        default=dict,
        help_text="JSON schema for Camper.admin_attributes")
    payment_schema = CustomJSONField(default=dict, help_text="JSON schema for Payment.attributes")
    registration_deposit_schema = CustomJSONField(
        null=True,
        help_text="variables to be used on the registration page deposits")
    registration_template_vars = CustomJSONField(
        default=dict,
        help_text="variables to be used on the registration page descriptions")
    registration_schema = CustomJSONField(
        default=dict,
        help_text="JSON schema for Registration.attributes")
    registration_ui_schema = CustomJSONField(
        default=dict,
        help_text="react-jsonschema-form uiSchema for registration form")
    registration_error_messages = CustomJSONField(
        default=dict,
        blank=True,
        help_text=(
            "Custom validation messages for the registration form: "
            "{ field path: { validation keyword: Handlebars message } }, where "
            "array indexes in the path are written as '*' and the path '*' "
            "holds event-wide defaults per keyword"))
    registration_admin_schema = CustomJSONField(
        default=dict,
        help_text="JSON schema for Registration.admin_attributes")
    deposit_schema = CustomJSONField(default=dict, help_text="JSON schema for Deposit.attributes")
    pricing = CustomJSONField(default=dict, help_text="key-value object with pricing variables")

    camper_pricing_logic = CustomJSONField(
        default=dict,
        help_text="JsonLogic Camper-level pricing components")
    registration_pricing_logic = CustomJSONField(
        default=dict,
        help_text="JsonLogic Registration-level pricing components")

    paypal_enabled = models.BooleanField(default=True)
    epayment_handling = models.DecimalField(
            null=True,
            max_digits=4,
            decimal_places=2,
            help_text="a handling charge added to all payments, but discounted if you pay by check")
    paypal_client_id = models.CharField(null=True, blank=True, max_length=255)

    pre_submit_template = models.TextField(
        blank=True,
        default='',
        help_text="Handlebars template, rendered right before registration submit button")
    confirmation_page_template = models.TextField(
        blank=True, default='',
        help_text="Jinja markdown template, rendered on the server when registration completes")

    # The registration confirmation email (an EmailTemplate, created with the event).
    confirmation_template = models.OneToOneField(
        'EmailTemplate', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    # The event's sending address: the confirmation's, and the default for its other email.
    confirmation_email_from = models.EmailField(blank=True, default='')

    email_account = models.ForeignKey(EmailAccount, null=True, on_delete=models.PROTECT)

    def __str__(self):
        return self.name

    def save(self, **kwargs):
        super().save(**kwargs)
        if self.confirmation_template_id is None:
            self.confirmation_template = EmailTemplate.objects.create(
                event=self, purpose=EmailTemplatePurpose.CONFIRMATION,
                name='Registration confirmation', subject=DEFAULT_CONFIRMATION_SUBJECT,
                body=DEFAULT_CONFIRMATION_BODY)
            super().save(update_fields=['confirmation_template'])

    def is_open(self):
        open = False
        now = datetime.date.today()
        long_ago = datetime.date(1979, 1, 1)
        far_future = datetime.date(2400, 1, 1)

        registration_start = self.registration_start or long_ago
        registration_end = self.registration_end or far_future
        if (now >= registration_start and now < registration_end):
            open = True
        return open

    @property
    def valid_payment_types(self):
        if self.paypal_enabled:
            return [PaymentType.CHECK, PaymentType.PAYPAL, PaymentType.CARD]
        return [PaymentType.CHECK]


class RegistrationType(TimeStampedModel):
    '''
    Registration type for special pricing options (Ex: Staff).
    Contains the email template to send out to a special registrant.
    '''
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    name = models.CharField(max_length=255, help_text="value exposed to JsonLogic")
    label = models.CharField(max_length=255, help_text="Human readable name")
    # The email inviting someone to register as this type (created with the type).
    invitation_template = models.OneToOneField(
        'EmailTemplate', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    camper_schema_overrides = CustomJSONField(
            default=dict,
            help_text="JSON schema for overriding camper schema items")
    registration_schema_overrides = CustomJSONField(
            default=dict,
            help_text="JSON schema for overriding registration schema items")
    ui_schema_overrides = CustomJSONField(
            default=dict,
            help_text="JSON schema for overriding camper schema items")

    def save(self, **kwargs):
        super().save(**kwargs)
        if self.invitation_template_id is None:
            self.invitation_template = EmailTemplate.objects.create(
                event_id=self.event_id, purpose=EmailTemplatePurpose.INVITATION,
                name=f'Invitation: {self.label}', subject=DEFAULT_INVITATION_SUBJECT,
                body=DEFAULT_INVITATION_BODY)
            super().save(update_fields=['invitation_template'])


class Registration(TimeStampedModel):
    '''
    Group of campers registering together.
    - Is owned by one Event
    - Has many attributes (probably in JSON form) that are custom added
    - Has many Campers
    - Has many Payments
    '''
    uuid = models.UUIDField(unique=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    registration_type = models.ForeignKey(RegistrationType, null=True, on_delete=models.CASCADE)
    attributes = CustomJSONField(null=True)
    admin_attributes = CustomJSONField(
        default=dict,
        help_text="custom attributes for administrative use")
    registrant_email = models.EmailField()
    server_pricing_results = CustomJSONField(null=True)
    client_reported_pricing = CustomJSONField(null=True)
    initial_payment = CustomJSONField(null=True)
    payment_type = models.CharField(
        max_length=255,
        null=True,
        choices=PaymentType.choices,
    )
    paypal_response = CustomJSONField(null=True)
    completed = models.BooleanField(
        default=False,
        help_text="True if the user has made it to the end of the registration process",
    )

    def __str__(self):
        return "Registration #{} ({})".format(self.id, self.event.name)

    def save(self, **kwargs):
        super().save(**kwargs)
        self.recalculate_server_pricing()

    def recalculate_server_pricing(self):
        campers = self.campers.all()
        server_pricing_results = pricing.calculate_price(
            self,
            campers,
        )

        camper_pricing = server_pricing_results['campers']
        for index, camper in enumerate(campers):
            camper.server_pricing_results = camper_pricing[index]
            camper.save_without_recalc()

        self.server_pricing_results = server_pricing_results
        super().save()


class Report(TimeStampedModel):
    '''
    Report for a given event.
    - Is owned by one Event
    - Has a title
    - Has a template: Jinja (csv/md/txt/html) or Handlebars (hbs)
    - Its Jinja variables come either from the server (`server`: the variable
      graph, SPEC §9.3) or, for older reports, from the client (`client`: the
      client posts them when rendering)
    '''
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    output = models.CharField(
        max_length=4,
        choices=ReportOutputType.choices,
        default=ReportOutputType.CSV,
    )
    variables_schema = CustomJSONField(
        default=dict,
        help_text="values schema for this reports variables")
    template = models.TextField(blank=True, default='', help_text="Jinja or Handlebars template")
    variables_source = models.CharField(
        max_length=10,
        choices=ReportVariablesSource.choices,
        default=ReportVariablesSource.SERVER,
        help_text="Where the template's variables come from")

    def __str__(self):
        return "Report #{} ({})".format(self.id, self.event.name)


class Invitation(TimeStampedModel):
    '''
    An Invitations is emailed as a link with a code for Registration types and is associated
    with a modiefied Registration page.
    random.choices takes visually unambigious characters and numbers so they can be read as
    text without confusions (0 vs O etc.).
    '''
    def invitation_code_default():
        return ''.join(random.choices('abcdefghjkmnpqrstuvwxyz23456789', k=8))

    registration = models.ForeignKey(Registration, null=True, on_delete=models.CASCADE)
    registration_type = models.ForeignKey(RegistrationType, null=True, on_delete=models.CASCADE)
    invitation_code = models.CharField(max_length=8, default=invitation_code_default)
    recipient_name = models.CharField(max_length=100, blank=True)
    recipient_email = models.EmailField()
    sent_time = models.DateTimeField(null=True)
    expiration_time = models.DateTimeField(null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['invitation_code', 'recipient_email'],
                name='email_invitation_code'
            ),
        ]


class Lodging(TimeStampedModel):
    '''
    - Recursive table that contains a series of lodging groups
    - Should be able to track capacity so that lodging options are
        removed from registration as they fill up
    '''
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True)
    name = models.CharField(max_length=255)
    children_title = models.CharField(
        max_length=255, blank=True, default='',
        help_text="title that goes on the dropdown field to select a child")
    # For non-leaf nodes, "capacity" and "reserved" should be set to zero.
    capacity = models.IntegerField(default=0, help_text="total camper capacity")
    reserved = models.IntegerField(default=0, help_text="number of reserved spots")
    visible = models.BooleanField(default=False, help_text="true if visible on registration form")
    sharing_multiplier = models.FloatField(
        default=1,
        help_text="campers with lodging_shared=True subtract this quantity from capacity")
    notes = models.TextField(blank=True, default='')

    def get_parents(self, parents=[]):
        parents = [self] if len(parents) == 0 else parents
        last_item = parents[0]
        parent = last_item.parent

        if parent is None:
            return parents

        parents.insert(0, parent)

        return self.get_parents(parents)

    @property
    def name_path(self):
        return ', '.join(map(
            lambda x: x.name,
            self.get_parents()))


class Camper(TimeStampedModel):
    '''
    - Is owned by one Registration
    - Has one Lodgings
    - Has many attributes (probably in JSON form) that are custom added
    - In the future, it would be nice to tie campers to multiple events,
        so we can track attendance over the years.
    '''
    registration = models.ForeignKey(
        Registration, related_name="campers", on_delete=models.CASCADE)
    lodging = models.ForeignKey(Lodging, on_delete=models.CASCADE, null=True)
    lodging_requested = models.ForeignKey(
        Lodging,
        related_name='lodging_requested',
        on_delete=models.CASCADE,
        null=True,
        help_text="original lodging at time of registration")
    lodging_reserved = models.BooleanField(
        default=False,
        help_text="true if this camper is assigned to a reserved lodging spot")
    lodging_shared = models.BooleanField(
        default=False,
        help_text="true if this camper is sharing a space with other camper(s)")
    lodging_shared_with = models.CharField(
        blank=True,
        default='',
        max_length=255,
        help_text="names of other campers in shared space, relevant if lodging_shared=True")
    lodging_comments = models.TextField(
        blank=True,
        default='',
        help_text="comments from the camper re: lodging")
    stay = CustomJSONField(
        null=True,
        help_text="JSON array of dates")
    server_pricing_results = CustomJSONField(null=True)
    attributes = CustomJSONField(null=True)
    sequence = models.IntegerField(
        default=0,
        help_text="order of the campers")
    admin_attributes = CustomJSONField(
        default=dict,
        help_text="custom attributes for administrative use")

    def save_without_recalc(self, **kwargs):
        super().save(**kwargs)

    def save(self, **kwargs):
        super().save(**kwargs)
        self.registration.recalculate_server_pricing()

    def delete(self, **kwargs):
        reg = self.registration
        super().delete(**kwargs)
        reg.recalculate_server_pricing()

    class Meta:
        ordering = ('sequence', 'id',)


class CustomChargeType(TimeStampedModel):
    '''
    Promotion codes to be used during Registration.  Promotion codes can only
    be applied at the registration level
    '''
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    label = models.CharField(max_length=255, help_text="human friendly name")
    name = models.CharField(max_length=255, help_text="machine name")


class CustomCharge(TimeStampedModel):
    '''
    Promotion codes to be used during Registration.  Promotion codes can only
    be applied at the registration level
    '''
    custom_charge_type = models.ForeignKey(CustomChargeType, on_delete=models.CASCADE)
    camper = models.ForeignKey(Camper, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0.00'))
    notes = models.TextField(blank=True, default='')

    def save(self, **kwargs):
        super().save(**kwargs)
        self.camper.registration.recalculate_server_pricing()

    def delete(self, **kwargs):
        reg = self.camper.registration
        super().delete(**kwargs)
        reg.recalculate_server_pricing()


class Deposit(TimeStampedModel):
    '''
    - Has many Payments
    '''
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    deposited_on = models.DateField(null=True)
    attributes = CustomJSONField(null=True)
    amount = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0.00'))


class Payment(TimeStampedModel):
    '''
    - Owned by 0 or 1 Deposits
    - Owned also by 1 Registration
    - Has an amount and type
    '''
    registration = models.ForeignKey(Registration, on_delete=models.CASCADE)
    payment_type = models.CharField(
        max_length=255,
        default=PaymentType.CHECK,
        choices=PaymentType.choices,
    )
    deposit = models.ForeignKey(Deposit, on_delete=models.CASCADE, null=True)
    paid_on = models.DateField(null=True)
    attributes = CustomJSONField(null=True)
    amount = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0.00'))
    paypal_order_details = CustomJSONField(null=True)
    notes = models.TextField(blank=True, default='')


class EmailMessageKind(models.TextChoices):
    CONFIRMATION = 'confirmation', 'Registration confirmation'
    CONFIRMATION_REPORT = 'confirmation_report', 'Confirmation email problem report'
    PAGE_REPORT = 'page_report', 'Confirmation page problem report'
    INVITATION = 'invitation', 'Invitation'
    BULK = 'bulk', 'Group email'
    TEST = 'test', 'Test email'


class EmailMessageStatus(models.TextChoices):
    QUEUED = 'queued', 'Queued'
    SENDING = 'sending', 'Sending'
    SENT = 'sent', 'Sent'
    FAILED = 'failed', 'Failed'
    CANCELLED = 'cancelled', 'Cancelled'


class EmailMessage(TimeStampedModel):
    '''
    One outgoing email: the outbox the worker delivers from, and the permanent
    record of what was sent, to whom, from which account, and how it went
    (camphoric.mail, SPEC DR-44). The content is rendered when the message is
    queued, so the record shows exactly what was sent.
    '''
    # Null for a message that isn't about an event (an email account's test message).
    event = models.ForeignKey(Event, null=True, blank=True, related_name='email_messages',
                              on_delete=models.CASCADE)
    kind = models.CharField(max_length=30, choices=EmailMessageKind.choices)
    registration = models.ForeignKey(
        Registration, null=True, blank=True, on_delete=models.SET_NULL)
    invitation = models.ForeignKey(
        Invitation, null=True, blank=True, on_delete=models.SET_NULL)
    # A group email's: its batch, its template and who in its recipient list.
    batch = models.ForeignKey(
        'EmailBatch', null=True, blank=True, related_name='messages', on_delete=models.SET_NULL)
    template = models.ForeignKey(
        'EmailTemplate', null=True, blank=True, related_name='messages',
        on_delete=models.SET_NULL)
    recipient_key = models.CharField(max_length=255, blank=True, default='')
    # A group email's one-click unsubscribe link (SPEC DR-48), sent as List-Unsubscribe.
    unsubscribe_url = models.CharField(max_length=1000, blank=True, default='')
    # The sending account (null: the server's default mailer). An account with
    # messages can't be deleted, so a queued message never changes servers.
    account = models.ForeignKey(EmailAccount, null=True, blank=True, on_delete=models.PROTECT)
    from_email = models.CharField(max_length=255)
    to = models.CharField(max_length=255)
    reply_to = models.CharField(max_length=255, blank=True)
    subject = models.TextField()
    text = models.TextField()
    html = models.TextField(blank=True)

    status = models.CharField(
        max_length=10, choices=EmailMessageStatus.choices, default=EmailMessageStatus.QUEUED)
    attempts = models.PositiveIntegerField(default=0)
    next_attempt_at = models.DateTimeField(default=timezone.now)
    lease_until = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    smtp_message_id = models.CharField(max_length=255, blank=True)
    # At most one live (not cancelled) message per key, e.g. confirmation:<registration id>.
    dedupe_key = models.CharField(max_length=255, null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['dedupe_key'],
                condition=models.Q(dedupe_key__isnull=False) & ~models.Q(status='cancelled'),
                name='email_message_dedupe_key',
            ),
        ]
        indexes = [
            models.Index(fields=['status', 'next_attempt_at'], name='email_message_due'),
            models.Index(fields=['account', 'sent_at'], name='email_message_account_sent'),
            models.Index(fields=['event', '-created_at'], name='email_message_event_recent'),
        ]

    def __str__(self):
        return f'{self.get_kind_display()} to {self.to} ({self.status})'


class WorkerHeartbeat(models.Model):
    '''
    A task worker's latest sign of life (camphoric.worker). The admin warns
    when no worker has reported in recently, and a worker exits (to be
    restarted) when its own heartbeat goes stale.
    '''
    worker_id = models.CharField(max_length=64, unique=True)
    hostname = models.CharField(max_length=255)
    pid = models.PositiveIntegerField()
    started_at = models.DateTimeField()
    seen_at = models.DateTimeField(db_index=True)

    def __str__(self):
        return f'{self.hostname}:{self.pid} ({self.worker_id})'


class EmailRecipientSource(models.TextChoices):
    '''Who a group email goes to (SPEC §8.9, DR-45).'''
    REGISTRATIONS = 'registrations', 'Registrations'
    CAMPERS = 'campers', 'Campers'
    MANUAL = 'manual', 'Listed addresses'


class EmailTemplatePurpose(models.TextChoices):
    CONFIRMATION = 'confirmation', 'Registration confirmation'
    INVITATION = 'invitation', 'Invitation'
    GROUP = 'group', 'Group email'


DEFAULT_CONFIRMATION_SUBJECT = 'Your registration for {{ event.name }}'
DEFAULT_CONFIRMATION_BODY = (
    'Thanks for registering for {{ event.name }}!\n\n'
    '{% for camper in campers %}- {{ camper.attributes.first_name }} '
    '{{ camper.attributes.last_name }}\n{% endfor %}\n'
    'Total: {{ pricing.total | money }}\n')
DEFAULT_INVITATION_SUBJECT = 'Register for {{ event.name }}'
DEFAULT_INVITATION_BODY = (
    'Dear {{ invitation.recipient_name or invitation.recipient_email }},\n\n'
    "You're invited to register for {{ event.name }} as {{ registration_type.label }}.\n\n"
    '[Register here]({{ invitation.register_url }})\n')


class EmailTemplate(TimeStampedModel):
    '''
    An email the event sends, written in Jinja markdown (SPEC DR-45): its
    registration confirmation, each registration type's invitation, and the
    emails it sends to groups.
    '''
    event = models.ForeignKey(Event, related_name='email_templates', on_delete=models.CASCADE)
    purpose = models.CharField(max_length=20, choices=EmailTemplatePurpose.choices)
    name = models.CharField(max_length=255)
    subject = models.CharField(max_length=255, blank=True, default='')
    body = models.TextField(blank=True, default='', help_text='Jinja markdown')
    from_email = models.CharField(
        max_length=255, blank=True, default='',
        help_text="The sender; blank: the event's confirmation_email_from")
    reply_to = models.CharField(
        max_length=255, blank=True, default='',
        help_text="Where replies go; blank: the sending account's default")
    account = models.ForeignKey(
        EmailAccount, null=True, blank=True, on_delete=models.SET_NULL,
        help_text="The sending account; blank: the event's")

    # Group emails only: who they go to by default (the send dialog starts here).
    recipient_source = models.CharField(
        max_length=16, choices=EmailRecipientSource.choices,
        default=EmailRecipientSource.REGISTRATIONS)
    filter = CustomJSONField(
        default=dict, blank=True,
        help_text='Rules choosing recipients: {combinator, rules: [{field, op, value}]}')
    filter_expression = models.TextField(
        blank=True, default='', help_text='A Jinja expression recipients must also pass')
    address_expression = models.TextField(
        blank=True, default='', help_text="Jinja for each recipient's address; blank: default")
    name_expression = models.TextField(
        blank=True, default='', help_text="Jinja for each recipient's name; blank: default")
    recipient_list = models.TextField(
        blank=True, default='', help_text='Listed addresses, one per line: email or Name <email>')
    include_incomplete = models.BooleanField(
        default=False, help_text="Also choose from registrations that weren't completed")

    def __str__(self):
        return self.name

    @property
    def sender(self):
        return self.from_email or self.event.confirmation_email_from


class EmailBatchStatus(models.TextChoices):
    SCHEDULED = 'scheduled', 'Scheduled'
    EXPANDING = 'expanding', 'Preparing'
    SENDING = 'sending', 'Sending'
    CANCELLED = 'cancelled', 'Cancelled'


class EmailBatch(TimeStampedModel):
    '''
    One send of a group email (SPEC §8.9, DR-45): the recipients the admin
    reviewed and a snapshot of what was sent to them. Its messages are the
    outbox rows; whether it's done is worked out from them.
    '''
    event = models.ForeignKey(Event, related_name='email_batches', on_delete=models.CASCADE)
    template = models.ForeignKey(
        EmailTemplate, null=True, blank=True, related_name='batches', on_delete=models.SET_NULL)
    name = models.CharField(max_length=255, help_text="The template's name when it was sent")
    subject = models.CharField(max_length=255, blank=True, default='')
    body = models.TextField(blank=True, default='')
    recipient_source = models.CharField(max_length=16, choices=EmailRecipientSource.choices)
    address_expression = models.TextField(blank=True, default='')
    name_expression = models.TextField(blank=True, default='')
    recipient_list = models.TextField(blank=True, default='')
    # The recipients chosen in the send dialog, e.g. ["camper:31", "address:pat@x.org"].
    recipient_keys = CustomJSONField(default=list)
    account = models.ForeignKey(EmailAccount, null=True, blank=True, on_delete=models.PROTECT)
    from_email = models.CharField(max_length=255, blank=True, default='')
    reply_to = models.CharField(max_length=255, blank=True, default='')
    skip_already_sent = models.BooleanField(default=True)
    send_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=10, choices=EmailBatchStatus.choices, default=EmailBatchStatus.SCHEDULED)
    # Recipients left out when it was prepared (gone since, already sent), and why.
    skipped = CustomJSONField(default=list, blank=True)
    # Where the site is reached from outside (for unsubscribe links), as it was when sent.
    link_base = models.CharField(max_length=255, blank=True, default='')
    error = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return f'{self.name} ({self.created_at:%Y-%m-%d})'


class EmailUnsubscribeSource(models.TextChoices):
    LINK = 'link', 'Unsubscribe link'
    ADMIN = 'admin', 'Added by an organizer'


class EmailUnsubscribe(TimeStampedModel):
    '''
    An address that asked not to get an event's group email (SPEC §8.9, DR-48).
    Group email skips it; confirmations and invitations still go to it.
    '''
    event = models.ForeignKey(Event, related_name='email_unsubscribes', on_delete=models.CASCADE)
    email = models.EmailField(help_text='Lowercased')
    source = models.CharField(max_length=10, choices=EmailUnsubscribeSource.choices)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['event', 'email'], name='email_unsubscribe_address'),
        ]

    def __str__(self):
        return f'{self.email} ({self.event})'

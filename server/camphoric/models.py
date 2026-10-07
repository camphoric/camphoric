from decimal import Decimal
import logging
import random
import secrets
import uuid
import zoneinfo

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower
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


def default_time_zone():
    '''A new event's time zone: the server's template time zone.'''
    return getattr(settings, 'CAMPHORIC_TEMPLATE_TIMEZONE', 'America/Los_Angeles')


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

    # Saving only these, a soft delete or restore can't overwrite anything else.
    SOFT_DELETE_FIELDS = ['deleted_at', 'updated_at']

    def soft_delete(self):
        self.deleted_at = timezone.now()
        self.save(update_fields=self.SOFT_DELETE_FIELDS)

    def soft_undelete(self):
        self.deleted_at = None
        self.save(update_fields=self.SOFT_DELETE_FIELDS)


# Registrations, campers and payments are soft-deleted through the API (SPEC
# DR-55). Their default manager — `objects`, and so related managers such as
# `registration.campers`, `get_object_or_404` and the API — shows only live
# rows; `all_objects` shows everything. A registration's campers, payments and
# charges go and come back with it, without being marked themselves.

class LiveRegistrations(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class LiveUnderRegistration(models.Manager):
    '''Campers and payments: not deleted, and neither is their registration.'''

    def get_queryset(self):
        return super().get_queryset().filter(
            deleted_at__isnull=True, registration__deleted_at__isnull=True)


class LivePromoCodes(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class LiveCustomCharges(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(
            deleted_at__isnull=True, camper__deleted_at__isnull=True,
            camper__registration__deleted_at__isnull=True)


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
    # An organization with events can't be deleted (SPEC DR-54).
    organization = models.ForeignKey(Organization, on_delete=models.PROTECT)
    name = models.CharField(max_length=255)
    # The registration window: instants. Admins enter and read them in the
    # event's time zone (SPEC §8.3, DR-97).
    registration_start = models.DateTimeField(null=True)
    registration_end = models.DateTimeField(null=True)
    time_zone = models.CharField(
        max_length=64,
        default=default_time_zone,
        help_text="The camp's IANA time zone (e.g. America/Los_Angeles)")
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
            help_text="a percent added to each electronic payment, on the amount paid")
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
    # The email a registrar sends with an invoice (an EmailTemplate, created with the event).
    invoice_template = models.OneToOneField(
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
        if self.invoice_template_id is None:
            self.invoice_template = EmailTemplate.objects.create(
                event=self, purpose=EmailTemplatePurpose.INVOICE, name='Invoice',
                subject=DEFAULT_INVOICE_SUBJECT, body=DEFAULT_INVOICE_BODY)
            super().save(update_fields=['invoice_template'])

    @property
    def zone(self):
        '''The event's time zone as a tzinfo.'''
        return zoneinfo.ZoneInfo(self.time_zone)

    def is_open(self):
        '''Whether registration is open now: from its start (inclusive) until its end.'''
        now = timezone.now()
        if self.registration_start and now < self.registration_start:
            return False
        if self.registration_end and now >= self.registration_end:
            return False
        return True

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

    def __str__(self):
        return self.label or self.name

    def save(self, **kwargs):
        super().save(**kwargs)
        if self.invitation_template_id is None:
            self.invitation_template = EmailTemplate.objects.create(
                event_id=self.event_id, purpose=EmailTemplatePurpose.INVITATION,
                name=f'Invitation: {self.label}', subject=DEFAULT_INVITATION_SUBJECT,
                body=DEFAULT_INVITATION_BODY)
            super().save(update_fields=['invitation_template'])


class PromoCodeScope(models.TextChoices):
    REGISTRATION = 'registration', 'Per registration'
    CAMPER = 'camper', 'Per camper'


class PromoCode(TimeStampedModel):
    '''
    A code a registrant can enter while registering for a discount (SPEC DR-67).
    Its `pricing_logic` works out the discount once for the registration or
    once per camper (`scope`), after every other price line (camphoric.pricing).

    Soft-deleted (DR-55): a deleted code can't be used any more, but the
    registrations that already have it keep it, and their discount.
    '''
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='promo_codes')
    label = models.CharField(
        max_length=255, help_text="human friendly name, shown on the discount's price line")
    code = models.CharField(max_length=255, help_text="what the registrant enters")
    pricing_logic = CustomJSONField(
        default=dict,
        help_text="JsonLogic expression for the discount amount (a positive number)")
    scope = models.CharField(
        max_length=20, choices=PromoCodeScope.choices, default=PromoCodeScope.REGISTRATION,
        help_text="whether the discount is worked out for the registration or for each camper")
    enabled = models.BooleanField(
        default=True, help_text="False if registrants can't use this code")
    expiration_date = models.DateTimeField(
        null=True, blank=True, help_text="registrants can't use this code after this time")

    objects = LivePromoCodes()
    all_objects = models.Manager()

    class Meta:
        constraints = [
            # Codes are entered without regard to case, and a deleted code's
            # text can be used again.
            models.UniqueConstraint(
                Lower('code'), 'event', condition=Q(deleted_at__isnull=True),
                name='promo_code_per_event'),
        ]

    def __str__(self):
        return self.label or self.code

    def is_valid(self, at=None):
        '''Whether a registrant may use this code (at `at`, or now).'''
        at = at or timezone.now()
        return self.enabled and (self.expiration_date is None or at <= self.expiration_date)

    @classmethod
    def find_valid(cls, event, code):
        '''The event's live, usable code the registrant typed, or None.'''
        promo_code = cls.objects.filter(event=event, code__iexact=(code or '').strip()).first()
        return promo_code if promo_code and promo_code.is_valid() else None

    def clashes_with_live_code(self):
        '''Whether another live code of the event has the same text.'''
        return PromoCode.objects.filter(
            event_id=self.event_id, code__iexact=self.code).exclude(pk=self.pk).exists()


class Registration(TimeStampedModel):
    '''
    Group of campers registering together.
    - Is owned by one Event
    - Has many attributes (probably in JSON form) that are custom added
    - Has many Campers
    - Has many Invoices, and Payments on them

    It's completed once the registrant presses a payment button (SPEC DR-91):
    from then on it's in the admin lists, unpaid until a payment arrives.
    '''
    uuid = models.UUIDField(unique=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    # Deleting a registration type leaves its registrations, with no type (SPEC DR-54).
    registration_type = models.ForeignKey(
        RegistrationType, null=True, on_delete=models.SET_NULL)
    # Promo codes are soft-deleted, so a registration keeps its code (SPEC DR-67).
    promo_code = models.ForeignKey(
        PromoCode, null=True, blank=True, on_delete=models.PROTECT,
        related_name='registrations')
    attributes = CustomJSONField(null=True)
    admin_attributes = CustomJSONField(
        default=dict,
        help_text="custom attributes for administrative use")
    registrant_email = models.EmailField()
    server_pricing_results = CustomJSONField(null=True)
    client_reported_pricing = CustomJSONField(null=True)
    completed = models.BooleanField(
        default=False,
        help_text="True once the registrant has pressed a payment button",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    # When the confirmation email was queued; a worker sweep sends any still
    # unsent half an hour after completion (SPEC DR-91).
    confirmation_sent_at = models.DateTimeField(null=True, blank=True)

    objects = LiveRegistrations()
    all_objects = models.Manager()

    def __str__(self):
        return "Registration #{} ({})".format(self.id, self.event.name)

    def get_additional_data(self):
        # Tags audit entries for the registration's history (camphoric.audit).
        return {'registration': self.id}

    def save(self, **kwargs):
        super().save(**kwargs)
        self.recalculate_server_pricing()

    def recalculate_server_pricing(self):
        # A deleted registration's price stays as it was (its campers are out of
        # sight); restoring it recalculates.
        if self.deleted_at is not None:
            return
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

    registration = models.ForeignKey(Registration, null=True, on_delete=models.SET_NULL)
    registration_type = models.ForeignKey(RegistrationType, null=True, on_delete=models.CASCADE)
    invitation_code = models.CharField(max_length=8, default=invitation_code_default)
    recipient_name = models.CharField(max_length=100, blank=True)
    recipient_email = models.EmailField()
    sent_time = models.DateTimeField(null=True)
    expiration_time = models.DateTimeField(null=True)

    def __str__(self):
        if self.recipient_name:
            return f'{self.recipient_name} <{self.recipient_email}>'
        return self.recipient_email

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['invitation_code', 'recipient_email'],
                name='email_invitation_code'
            ),
        ]


class LodgingAvailability(models.TextChoices):
    '''Whether the registration form offers a lodging (issue #602).'''
    AUTO = 'auto', 'By capacity'
    FULL = 'full', 'Always full'
    OPEN = 'open', 'Always open'


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
    # An organizer can mark a lodging full whatever its count says, or keep it
    # open past its capacity (camphoric.lodging).
    availability = models.CharField(
        max_length=4, choices=LodgingAvailability.choices, default=LodgingAvailability.AUTO,
        help_text="whether registration offers it: by capacity, always full, or always open")

    def __str__(self):
        return self.name

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
    # Deleting a lodging leaves its campers, unassigned (SPEC DR-54).
    lodging = models.ForeignKey(Lodging, on_delete=models.SET_NULL, null=True)
    lodging_requested = models.ForeignKey(
        Lodging,
        related_name='lodging_requested',
        on_delete=models.SET_NULL,
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

    objects = LiveUnderRegistration()
    all_objects = models.Manager()

    def __str__(self):
        attributes = self.attributes or {}
        parts = (attributes.get('first_name'), attributes.get('last_name'))
        name = ' '.join(str(part) for part in parts if part)
        return name or "Camper #{}".format(self.id)

    def get_additional_data(self):
        # Tags audit entries for the registration's and camper's histories (camphoric.audit).
        return {'registration': self.registration_id, 'camper': self.id}

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
    A kind of charge (or credit) a registrar can add to a camper, such as extra
    bedding. Camper pricing logic sees each camper's charges.
    '''
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    label = models.CharField(max_length=255, help_text="human friendly name")
    name = models.CharField(max_length=255, help_text="machine name")

    def __str__(self):
        return self.label or self.name


class CustomCharge(TimeStampedModel):
    '''
    A charge (or, when negative, a credit) a registrar has added to a camper.
    '''
    # A charge type campers still have can't be deleted (SPEC DR-54).
    custom_charge_type = models.ForeignKey(CustomChargeType, on_delete=models.PROTECT)
    camper = models.ForeignKey(Camper, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0.00'))
    notes = models.TextField(blank=True, default='')

    objects = LiveCustomCharges()
    all_objects = models.Manager()

    def __str__(self):
        return "{} ${}".format(self.custom_charge_type.label, self.amount)

    def get_additional_data(self):
        # Tags audit entries for the registration's and camper's histories (camphoric.audit).
        return {'registration': self.camper.registration_id, 'camper': self.camper_id}

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

    def __str__(self):
        return "Deposit ${}{}".format(
            self.amount, f' on {self.deposited_on}' if self.deposited_on else '')


class InvoiceOrigin(models.TextChoices):
    '''Who or what made an invoice (SPEC §9.7). Informational: it never changes the ledger.'''
    # The registrant's payment step: the payment option they chose.
    REGISTRATION = 'registration', 'From registration'
    # A payment recorded with no invoice to go on; it stands for a bill never sent.
    PAYMENT_RECEIVED = 'payment_received', 'Payment received'
    # A registrar's, by hand.
    ADMIN = 'admin', 'Created by a registrar'
    # The conversion of payments to invoices (migration 0076) only.
    MIGRATED = 'migrated', 'Converted'


class InvoiceStatus(models.TextChoices):
    '''Worked out from the invoice and its payments, never stored.'''
    OPEN = 'open', 'Open'
    PARTIALLY_PAID = 'partially_paid', 'Partially paid'
    PAID = 'paid', 'Paid'
    OVERPAID = 'overpaid', 'Overpaid'
    CANCELLED = 'cancelled', 'Cancelled'


def invoice_token():
    '''An invoice's unguessable link code (module level: migrations reference it).'''
    return secrets.token_urlsafe(24)


class Invoice(TimeStampedModel):
    '''
    A request for one chunk of a registration's balance (SPEC §9.7, DR-87): an
    amount toward the registration, plus the e-payment handling fee once it's
    paid online (DR-88). Every payment belongs to one; it holds any number of
    payments and refunds, and its status comes from their net sum.
    '''
    registration = models.ForeignKey(
        Registration, on_delete=models.CASCADE, related_name='invoices')
    origin = models.CharField(max_length=20, choices=InvoiceOrigin.choices)
    description = models.CharField(max_length=255, blank=True, default='')
    amount = models.DecimalField(
        max_digits=7, decimal_places=2, default=Decimal('0.00'),
        help_text='Toward the registration')
    handling = models.DecimalField(
        max_digits=7, decimal_places=2, default=Decimal('0.00'),
        help_text='E-payment handling: adds to what is owed')
    # How the payer chose to pay it; each payment keeps how it was actually paid.
    payment_type = models.CharField(
        max_length=255, null=True, blank=True, choices=PaymentType.choices)
    token = models.CharField(max_length=64, unique=True, default=invoice_token, editable=False)
    due_on = models.DateField(null=True, blank=True)
    memo = models.TextField(blank=True, default='', help_text='Shown to the payer')
    notes = models.TextField(blank=True, default='', help_text='Internal')
    # A PayPal order made for it and not yet captured.
    pending_paypal_order_id = models.CharField(max_length=64, null=True, blank=True)
    # When a registrar or admin last changed what it asks (amount, description,
    # handling) or cancelled or reopened it. The registration's payment step
    # doesn't rewrite it after that (SPEC DR-105).
    organizer_changed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='+')

    objects = LiveUnderRegistration()
    all_objects = models.Manager()

    class Meta:
        ordering = ('created_at', 'id')

    def __str__(self):
        return f'Invoice #{self.id}' + (f' ({self.description})' if self.description else '')

    def get_additional_data(self):
        # Tags audit entries for the registration's history (camphoric.audit).
        return {'registration': self.registration_id}

    @property
    def total(self):
        return Decimal(self.amount) + Decimal(self.handling)

    @property
    def amount_paid(self):
        '''The net of its live payments: refunds count against it.'''
        return sum((Decimal(p.amount) for p in self.payments.all()), Decimal('0.00'))

    @property
    def amount_due(self):
        return max(Decimal('0.00'), self.total - self.amount_paid)

    @property
    def overpaid(self):
        return max(Decimal('0.00'), self.amount_paid - self.total)

    @property
    def status(self):
        if self.cancelled_at is not None:
            return InvoiceStatus.CANCELLED
        paid = self.amount_paid
        total = self.total
        if paid > total:
            return InvoiceStatus.OVERPAID
        if paid == total and (total > 0 or self.payments.exists()):
            return InvoiceStatus.PAID
        if paid > 0:
            return InvoiceStatus.PARTIALLY_PAID
        return InvoiceStatus.OPEN


class Payment(TimeStampedModel):
    '''
    - Owned by 0 or 1 Deposits
    - Owned also by 1 Registration, and 1 of its Invoices
    - Has an amount and type; a negative amount is a refund (SPEC DR-94)
    '''
    registration = models.ForeignKey(Registration, on_delete=models.CASCADE)
    # Every payment belongs to an invoice (SPEC DR-87); an invoice with
    # payments can't be deleted.
    invoice = models.ForeignKey(Invoice, on_delete=models.RESTRICT, related_name='payments')
    payment_type = models.CharField(
        max_length=255,
        default=PaymentType.CHECK,
        choices=PaymentType.choices,
    )
    # Deleting a deposit leaves its payments (SPEC DR-54).
    deposit = models.ForeignKey(Deposit, on_delete=models.SET_NULL, null=True)
    paid_on = models.DateField(null=True)
    attributes = CustomJSONField(null=True)
    amount = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0.00'))
    # PayPal's reply: the capture's for a payment, the refund's for a refund.
    paypal_response = CustomJSONField(null=True)
    # PayPal's transaction id: the capture id of a payment, the refund id of a
    # refund — so one PayPal transaction is recorded once.
    paypal_transaction_id = models.CharField(max_length=64, null=True, blank=True, unique=True)
    # The payment a refund gives money back from.
    refund_of = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.RESTRICT, related_name='refunds')
    notes = models.TextField(blank=True, default='')

    objects = LiveUnderRegistration()
    all_objects = models.Manager()

    def __str__(self):
        kind = 'refund' if self.is_refund else 'payment'
        return "{} {} ${}".format(self.get_payment_type_display(), kind, abs(self.amount))

    @property
    def is_refund(self):
        return Decimal(self.amount) < 0

    def save(self, **kwargs):
        # Every payment belongs to an invoice (SPEC DR-87): one saved without
        # one goes on the oldest invoice with money due, or a new one for it.
        if self.invoice_id is None:
            from camphoric import invoices
            self.invoice = invoices.invoice_for_payment(
                self.registration, self.amount, self.payment_type)
        super().save(**kwargs)

    def get_additional_data(self):
        # Tags audit entries for the registration's history (camphoric.audit).
        return {'registration': self.registration_id}


class PricingOverride(TimeStampedModel):
    '''
    A registrar's amount for one price line of a registration or camper, in place
    of what the pricing logic computes (SPEC DR-56). It's applied right after that
    line is worked out, so everything after it — the totals, deposits — follows;
    the total itself can't be overridden. Registrants only ever see the result.
    '''
    registration = models.ForeignKey(
        Registration, on_delete=models.CASCADE, related_name='pricing_overrides')
    # Null: a line of the registration itself (a donation, the handling fee).
    camper = models.ForeignKey(
        Camper, null=True, blank=True, on_delete=models.CASCADE,
        related_name='pricing_overrides')
    var = models.CharField(max_length=255, help_text="the pricing line's var")
    amount = models.DecimalField(max_digits=7, decimal_places=2)
    reason = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='+')

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['camper', 'var'], condition=models.Q(camper__isnull=False),
                name='one_override_per_camper_line'),
            models.UniqueConstraint(
                fields=['registration', 'var'], condition=models.Q(camper__isnull=True),
                name='one_override_per_registration_line'),
        ]

    def __str__(self):
        from camphoric.pricing import line_label
        label = line_label(self.registration.event, self.var, camper=self.camper_id is not None)
        whose = f' for {self.camper}' if self.camper_id else ''
        amount = Decimal(self.amount)
        return f'{label}{whose}: {"-" if amount < 0 else ""}${abs(amount):.2f}'

    def get_additional_data(self):
        # Tags audit entries for the registration's and camper's histories (camphoric.audit).
        return {'registration': self.registration_id, 'camper': self.camper_id}

    def save(self, **kwargs):
        super().save(**kwargs)
        Registration.all_objects.get(pk=self.registration_id).recalculate_server_pricing()

    def delete(self, **kwargs):
        registration = Registration.all_objects.get(pk=self.registration_id)
        result = super().delete(**kwargs)
        registration.recalculate_server_pricing()
        return result


class EmailMessageKind(models.TextChoices):
    CONFIRMATION = 'confirmation', 'Registration confirmation'
    CONFIRMATION_REPORT = 'confirmation_report', 'Confirmation email problem report'
    PAGE_REPORT = 'page_report', 'Confirmation page problem report'
    # A PayPal capture or refund whose outcome is unknown (SPEC §9.7).
    PAYMENT_REPORT = 'payment_report', 'PayPal problem report'
    # An invoice a registrar sent, with its pay link (SPEC §9.7, DR-95).
    INVOICE = 'invoice', 'Invoice'
    INVITATION = 'invitation', 'Invitation'
    BULK = 'bulk', 'Group email'
    TEST = 'test', 'Test email'
    # Set-password and password-reset links (SPEC DR-52).
    ACCOUNT = 'account', 'Account email'


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
    INVOICE = 'invoice', 'Invoice'


DEFAULT_CONFIRMATION_SUBJECT = 'Your registration for {{ event.name }}'
DEFAULT_CONFIRMATION_BODY = (
    'Thanks for registering for {{ event.name }}!\n\n'
    '{% for camper in campers %}- {{ camper.attributes.first_name }} '
    '{{ camper.attributes.last_name }}\n{% endfor %}\n'
    'Total: {{ registration.total_owed | money }}\n'
    '{% if registration.balance > 0 %}Still due: {{ registration.balance | money }}\n'
    '{% endif %}')
DEFAULT_INVOICE_SUBJECT = 'Invoice #{{ invoice.id }} for {{ event.name }}'
DEFAULT_INVOICE_BODY = (
    'Hello,\n\n'
    '{% if invoice.memo %}{{ invoice.memo }}\n\n{% endif %}'
    'Your invoice for {{ event.name }}'
    '{% if campers %} ({% for camper in campers %}{{ camper.attributes.first_name }}'
    '{{ ", " if not loop.last }}{% endfor %}){% endif %}:\n\n'
    '**{{ invoice.description or "Registration" }}: {{ invoice.amount_due | money }} due**'
    '{% if invoice.due_on %} by {{ invoice.due_on | date("%B %-d, %Y") }}{% endif %}\n\n'
    '[Pay online]({{ invoice.pay_url }})\n')
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


class UserAccount(models.Model):
    '''
    What Camphoric keeps about a user beside Django's User (SPEC DR-52):
    whether a password a superuser set must be changed at the next sign-in.
    Created only when needed.
    '''
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, related_name='camphoric_account', on_delete=models.CASCADE)
    must_change_password = models.BooleanField(default=False)

    def __str__(self):
        return f'{self.user} account'

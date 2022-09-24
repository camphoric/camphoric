from decimal import Decimal
import datetime
import random
import uuid

from django.db import models
from django.utils import timezone

# Useful docs:
# - https://docs.djangoproject.com/en/4.1/ref/models/fields/


class PaymentType(models.TextChoices):
    CHECK = 'Check', 'Check'
    PAYPAL = 'PayPal', 'PayPal'
    CARD = 'Card', 'Debit or Credit Card'
    VOUCHER = 'Voucher', 'Discount or Gifted Credit'


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
    username = models.CharField(max_length=255)
    password = models.CharField(max_length=255)

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
    camper_schema = models.JSONField(default=dict, help_text="JSON schema for Camper.attributes")
    payment_schema = models.JSONField(default=dict, help_text="JSON schema for Payment.attributes")
    registration_schema = models.JSONField(
        default=dict,
        help_text="JSON schema for Registration.attributes")
    registration_ui_schema = models.JSONField(
        default=dict,
        help_text="react-jsonschema-form uiSchema for registration form")
    registration_admin_schema = models.JSONField(
        default=dict,
        help_text="JSON schema for Registration.admin_attributes")
    deposit_schema = models.JSONField(default=dict, help_text="JSON schema for Deposit.attributes")
    pricing = models.JSONField(default=dict, help_text="key-value object with pricing variables")

    camper_pricing_logic = models.JSONField(
        default=dict,
        help_text="JsonLogic Camper-level pricing components")
    registration_pricing_logic = models.JSONField(
        default=dict,
        help_text="JsonLogic Registration-level pricing components")

    paypal_enabled = models.BooleanField(default=True)
    paypal_client_id = models.CharField(null=True, blank=True, max_length=255)

    pre_submit_template = models.TextField(
        blank=True,
        default='',
        help_text="Handlebars template, rendered right before registration submit button")
    confirmation_page_template = models.TextField(
        blank=True, default='', help_text="Handlebars template")

    confirmation_email_subject = models.CharField(blank=True, default='', max_length=100)
    confirmation_email_template = models.TextField(
        blank=True, default='', help_text="Handlebars template")
    confirmation_email_from = models.EmailField(blank=True, default='')

    email_account = models.ForeignKey(EmailAccount, null=True, on_delete=models.CASCADE)

    def __str__(self):
        return self.name

    def is_open(self):
        open = False
        now = timezone.now()
        long_ago = datetime.datetime(1979, 1, 1, tzinfo=timezone.get_current_timezone())
        far_future = datetime.datetime(2400, 1, 1, tzinfo=timezone.get_current_timezone())

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
    invitation_email_subject = models.CharField(max_length=255)
    invitation_email_template = models.TextField(null=True, blank=True)


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
    attributes = models.JSONField(null=True)
    admin_attributes = models.JSONField(
        default=dict,
        help_text="custom attributes for administrative use")
    registrant_email = models.EmailField()
    server_pricing_results = models.JSONField(null=True)
    client_reported_pricing = models.JSONField(null=True)
    payment_type = models.CharField(
        max_length=255,
        null=True,
        choices=PaymentType.choices,
    )
    paypal_response = models.JSONField(null=True)

    def __str__(self):
        return "Registration #{} ({})".format(self.id, self.event.name)


class Report(TimeStampedModel):
    '''
    Report for a given event.
    - Is owned by one Event
    - Has a title
    - Has a handlebars template
    '''
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    template = models.TextField(blank=True, default='', help_text="Handlebars template")

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
    stay = models.JSONField(
        null=True,
        help_text="JSON array of dates")
    attributes = models.JSONField(null=True)


class Deposit(TimeStampedModel):
    '''
    - Has many Payments
    '''
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    deposited_on = models.DateField(null=True)
    attributes = models.JSONField(null=True)
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
    attributes = models.JSONField(null=True)
    amount = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0.00'))
    paypal_order_details = models.JSONField(null=True)

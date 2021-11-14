import random

from decimal import Decimal

from django.db import models
from django.utils import timezone


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
    registration_start = models.DateTimeField(null=True)
    registration_end = models.DateTimeField(null=True)
    start = models.DateTimeField(null=True)
    end = models.DateTimeField(null=True)
    camper_schema = models.JSONField(null=True, help_text="JSON schema for Camper.attributes")
    payment_schema = models.JSONField(null=True, help_text="JSON schema for Payment.attributes")
    registration_schema = models.JSONField(
        null=True,
        help_text="JSON schema for Registration.attributes")
    registration_ui_schema = models.JSONField(
        null=True,
        help_text="react-jsonschema-form uiSchema for registration form")
    deposit_schema = models.JSONField(null=True, help_text="JSON schema for Deposit.attributes")
    pricing = models.JSONField(null=True, help_text="key-value object with pricing variables")
    camper_pricing_logic = models.JSONField(
        null=True,
        help_text="JsonLogic Camper-level pricing components")
    registration_pricing_logic = models.JSONField(
        null=True,
        help_text="JsonLogic Registration-level pricing components")

    confirmation_page_template = models.TextField(blank=True, default='', help_text="Mustache template")
    confirmation_email_subject = models.CharField(default='', max_length=100)
    confirmation_email_template = models.TextField(blank=True, default='', help_text="Mustache template")
    confirmation_email_from = models.EmailField()

    def __str__(self):
        return self.name


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
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    registration_type = models.ForeignKey(RegistrationType, null=True, on_delete=models.CASCADE)
    attributes = models.JSONField(null=True)
    registrant_email = models.EmailField()
    server_pricing_results = models.JSONField(null=True)
    client_reported_pricing = models.JSONField(null=True)

    def __str__(self):
        return "Registration #{} ({})".format(self.id, self.event.name)


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
    # For non-leaf nodes, "capacity" and "reserved" should be set to zero. 
    capacity = models.IntegerField(default=0, help_text="total camper capacity") 
    reserved = models.IntegerField(default=0, help_text="number of reserved spots remaining")
    visible = models.BooleanField(default=False, help_text="true if visible on registration form")
    notes = models.TextField()


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
    attributes = models.JSONField(null=True)


class Deposit(TimeStampedModel):
    '''
    - Has many Payments
    '''
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    deposited_on = models.DateTimeField(null=True)
    attributes = models.JSONField(null=True)
    amount = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0.00'))


class Payment(TimeStampedModel):
    '''
    - Owned by 0 or 1 Deposits
    - Owned also by 1 Registration
    - Has an amount and type
    '''
    registration = models.ForeignKey(Registration, on_delete=models.CASCADE)
    deposit = models.ForeignKey(Deposit, on_delete=models.CASCADE)
    paid_on = models.DateTimeField(null=True)
    attributes = models.JSONField(null=True)
    amount = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0.00'))

from decimal import Decimal

from django.contrib.postgres.fields import JSONField
from django.db import models
from django.utils import timezone


# Users are built into Django. No class needed.
# Do we need tags given that we will have JSONFields?
# Sign Model not yet implemented. Needs more discussion.


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
    '''
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    registration_start = models.DateTimeField(null=True)
    registration_end = models.DateTimeField(null=True)
    start = models.DateTimeField(null=True)
    end = models.DateTimeField(null=True)
    camper_schema = JSONField(null=True)
    payment_schema = JSONField(null=True)
    registration_schema = JSONField(null=True)
    registration_ui_schema = JSONField(null=True)
    deposit_schema = JSONField(null=True)
    pricing = JSONField(null=True)
    camper_pricing_logic = JSONField(null=True)
    registration_pricing_logic = JSONField(null=True)


    def __str__(self):
        return self.name


class Registration(TimeStampedModel):
    '''
    Group of campers registering together.
    - Is owned by one Event
    - Has many attributes (probably in JSON form) that are custom added
    - Has many Campers
    - Has many Payments
    '''
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    attributes = JSONField(null=True)

    def __str__(self):
        return "Registration #{} ({})".format(self.id, self.event.name)


class Lodging(TimeStampedModel):
    '''
    - Recursive table that contains a series of lodging groups
    - Should be able to track capacity so that lodging options are removed from registration as they fill up
    '''
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True)
    name = models.CharField(max_length=255)
    capacity = models.IntegerField(default=0)
    notes = models.TextField()
    # is_visible = models.boolean()


class Camper(TimeStampedModel):
    '''
    - Is owned by one Registration
    - Has one Lodgings
    - Has many attributes (probably in JSON form) that are custom added
    - In the future, it would be nice to tie campers to multiple events, so we can track attendance over the years
    '''
    registration = models.ForeignKey(Registration, on_delete=models.CASCADE)
    lodging = models.ForeignKey(Lodging, on_delete=models.CASCADE)
    attributes = JSONField(null=True)


class Deposit(TimeStampedModel):
    '''
    - Has many Payments
    '''
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    deposited_on = models.DateTimeField(null=True)
    attributes = JSONField(null=True)  # TODO: Add schema or remove attributes. Is it needed?
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
    attributes = JSONField(null=True)
    amount = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal('0.00'))

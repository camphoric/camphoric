'''
Cash is a built-in payment type and Voucher no longer is (SPEC DR-176). An event
that has Voucher payments or invoices gets Voucher as one of its own types
(DR-164), labelled as it was, so they read and filter the same way; an own Cash
type gives way to the built-in one. Both are stored with the built-in's spelling.
'''

from django.db import migrations
from django.db.models import Q

VOUCHER = {'value': 'Voucher', 'label': 'Discount or Gifted Credit'}
CASH = {'value': 'Cash', 'label': 'Cash'}


def _is(entry, value):
    '''Whether an own type's entry is `value`, ignoring case and surrounding spaces.'''
    return (isinstance(entry, dict) and isinstance(entry.get('value'), str)
            and entry['value'].strip().casefold() == value.casefold())


def _events_paid_as(apps, value):
    '''The ids of the events with a payment or an invoice stored as `value`, in any case.'''
    Event = apps.get_model('camphoric', 'Event')
    return Event.objects.filter(
        Q(registration__payment__payment_type__iexact=value)
        | Q(registration__invoices__payment_type__iexact=value)
    ).values_list('pk', flat=True).distinct()


def _normalize(apps, value):
    '''Store every payment and invoice of `value`, in any case, with that spelling.'''
    for name in ('Payment', 'Invoice'):
        apps.get_model('camphoric', name).objects.filter(
            payment_type__iexact=value).exclude(payment_type=value).update(payment_type=value)


def _own(event):
    '''The event's own types as a list (one saved as anything else is read as none).'''
    return list(event.payment_types) if isinstance(event.payment_types, list) else []


def forwards(apps, schema_editor):
    Event = apps.get_model('camphoric', 'Event')

    for event in Event.objects.filter(pk__in=list(_events_paid_as(apps, 'Voucher'))):
        types = _own(event)
        matches = [i for i, entry in enumerate(types) if _is(entry, 'Voucher')]
        if matches:
            # One saved through the Django admin was hidden behind the built-in
            # type; it now stands in for it, spelled as the payments are.
            types[matches[0]] = {**types[matches[0]], 'value': VOUCHER['value']}
            if not (isinstance(types[matches[0]].get('label'), str)
                    and types[matches[0]]['label']):
                types[matches[0]]['label'] = VOUCHER['label']
        else:
            types.append(dict(VOUCHER))
        Event.objects.filter(pk=event.pk).update(payment_types=types)
    _normalize(apps, 'Voucher')

    for event in Event.objects.all():
        types = _own(event)
        kept = [entry for entry in types if not _is(entry, 'Cash')]
        if len(kept) != len(types):
            Event.objects.filter(pk=event.pk).update(payment_types=kept)
    _normalize(apps, 'Cash')


def backwards(apps, schema_editor):
    Event = apps.get_model('camphoric', 'Event')

    for event in Event.objects.all():
        types = _own(event)
        kept = [entry for entry in types if not _is(entry, 'Voucher')]
        if len(kept) != len(types):
            Event.objects.filter(pk=event.pk).update(payment_types=kept)

    for event in Event.objects.filter(pk__in=list(_events_paid_as(apps, 'Cash'))):
        types = _own(event)
        if not any(_is(entry, 'Cash') for entry in types):
            Event.objects.filter(pk=event.pk).update(payment_types=[*types, dict(CASH)])


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0100_event_cancellation_fee'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]

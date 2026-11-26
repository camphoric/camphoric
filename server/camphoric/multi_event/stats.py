'''
Attendance and retention across the included events (SPEC §8.12, DR-180).

Someone counted is a person (their linked camper records) or, for a record not
linked to anyone, that record alone: an unlinked record of a returning camper
counts as someone new until it's linked. Events are taken in time order (their
start, else their opening). Retention compares each event with the one before
it in its series; events with no series are a series of their own.
'''

from collections import Counter, defaultdict
from decimal import Decimal

from django.db.models import Sum

from camphoric import models
from camphoric.multi_event import people


def _key(record):
    return f'person:{record.person}' if record.person else f'camper:{record.camper}'


def longest_run(years):
    '''The most consecutive calendar years in a set of years.'''
    best = run = 0
    previous = None
    for year in sorted(years):
        run = run + 1 if previous is not None and year == previous + 1 else 1
        best = max(best, run)
        previous = year
    return best


def stats(organization, series=None):
    '''
    `{series, events, people}`: the included events' series names; for each
    event in scope (a series, or all), its totals, new and returning people,
    how many came back from the one before it in its series, and the money
    received for it (as text, like the API's other amounts); and each
    person's attendance across them.
    '''
    all_events = people.included_events(organization)
    events = [e for e in all_events if series is None or e.multi_event.series == series]
    records = people.records(organization, events)
    registrations = Counter(
        models.Registration.objects.filter(event__in=events).values_list('event', flat=True))
    # Payments less refunds (a refund is a negative payment), live ones only.
    received = dict(models.Payment.objects.filter(registration__event__in=events)
                    .values_list('registration__event').annotate(Sum('amount')))

    by_event = defaultdict(list)
    for record in records:
        by_event[record.event].append(record)

    seen = set()
    attendees = {}
    last_in_series = {}
    rows = []
    for event in events:
        here = {_key(r) for r in by_event[event.id]}
        new = here - seen
        event_series = event.multi_event.series
        previous = last_in_series.get(event_series)
        date = people.event_date(event)
        rows.append({
            'event': event.id,
            'name': event.name,
            'series': event_series,
            'date': date,
            'year': date.year if date else None,
            'campers': len(by_event[event.id]),
            'registrations': registrations.get(event.id, 0),
            'received': str(received.get(event.id) or Decimal('0.00')),
            'people': len(here),
            'new': len(new),
            'returning': len(here) - len(new),
            'previous': None if previous is None else {
                'event': previous.id,
                'name': previous.name,
                'people': len(attendees[previous.id]),
                'returned': len(attendees[previous.id] & here),
            },
        })
        seen |= here
        attendees[event.id] = here
        last_in_series[event_series] = event

    order = {event.id: index for index, event in enumerate(events)}
    dates = {event.id: people.event_date(event) for event in events}
    grouped = defaultdict(list)
    for record in records:
        grouped[_key(record)].append(record)
    rows_people = []
    for key, mine in grouped.items():
        mine.sort(key=lambda r: (order[r.event], r.camper))
        attended = sorted({r.event for r in mine}, key=order.get)
        years = {dates[e].year for e in attended if dates[e]}
        rows_people.append({
            'key': key,
            'person': mine[0].person,
            'campers': [r.camper for r in mine],
            'name': mine[-1].name,
            'events': attended,
            'attended': len(attended),
            'first_event': attended[0],
            'last_event': attended[-1],
            'longest_run': longest_run(years),
        })
    rows_people.sort(key=lambda p: (-p['attended'], p['name'].lower(), p['key']))

    return {
        'series': sorted({e.multi_event.series for e in all_events if e.multi_event.series},
                         key=str.lower),
        'events': rows,
        'people': rows_people,
    }

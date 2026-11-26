'''
The included events and their camper records, and linking records as one person
(SPEC §8.12, DR-177).

A person ties together camper records from different events of one
organization; it has at most one live record per event and at least two
records. Only live campers (DR-55) of included events take part: a record
whose event is left out keeps its link, and shows again when the event is
included again. Links are written with each camper's save, so the audit log
(DR-53) records them in the camper's history.
'''

from dataclasses import dataclass
import datetime
import itertools

from django.db import transaction
from django.db.models import F
from django.db.models.functions import Lower
from django.db.models.signals import post_delete
from django.dispatch import receiver
from rest_framework.exceptions import ValidationError

from camphoric import models


def ordered_events(organization):
    '''The organization's events in the event chooser's order (DR-156).'''
    return (models.Event.objects.filter(organization=organization)
            .select_related('multi_event')
            .order_by(F('registration_start').desc(nulls_first=True), Lower('name'), 'id'))


def inclusion_of(event):
    try:
        return event.multi_event
    except models.MultiEventInclusion.DoesNotExist:
        return None


def event_row(event):
    inclusion = inclusion_of(event)
    return {
        'event': event.id,
        'name': event.name,
        'start': event.start,
        'end': event.end,
        'registration_start': event.registration_start,
        'included': bool(inclusion and inclusion.included),
        'series': inclusion.series if inclusion else '',
    }


def event_date(event):
    '''When an event happened, for putting events in order: its start, else its opening.'''
    if event.start:
        return event.start
    if event.registration_start:
        return event.registration_start.date()
    return None


def chronological(events):
    '''Events oldest first, those with no date last.'''
    return sorted(events, key=lambda e: (event_date(e) is None, event_date(e) or
                                         datetime.date.min, e.id))


def included_events(organization, series=None):
    '''The organization's included events, oldest first; only one series' when named.'''
    events = models.Event.objects.filter(
        organization=organization, multi_event__included=True).select_related('multi_event')
    if series is not None:
        events = events.filter(multi_event__series=series)
    return chronological(events)


def set_inclusion(event, *, included=None, series=None):
    '''Include or leave out an event, or change its series.'''
    inclusion = inclusion_of(event) or models.MultiEventInclusion(event=event, included=False)
    if included is not None:
        inclusion.included = included
    if series is not None:
        inclusion.series = ' '.join(series.split())
    inclusion.save()
    event.multi_event = inclusion
    return event_row(event)


def included_campers(organization, events=None):
    '''The live campers of the included events (or of `events`), with their registrations.'''
    campers = models.Camper.objects.filter(
        registration__event__organization=organization,
        registration__event__multi_event__included=True)
    if events is not None:
        campers = campers.filter(registration__event__in=events)
    return campers.select_related('registration', 'person').order_by('id')


def own_person_id(camper, organization):
    '''
    The camper's person, when it's one of the organization's. A camper (or its
    event) moved to another organization keeps a link that means nothing there:
    it counts as linked to no one, and linking it there takes it from that person.
    '''
    person = camper.person
    return person.pk if person is not None and person.organization_id == organization.pk \
        else None


def _text(value):
    return value.strip() if isinstance(value, str) and value.strip() else None


def _scalar(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return str(value)
    return _text(value)


@dataclass(frozen=True)
class Record:
    '''What multi-event reports read from one camper record.'''
    camper: int
    event: int
    registration: int
    person: int | None
    name: str
    first_name: str | None
    last_name: str | None
    age: str | None
    email: str | None
    registrant_email: str | None

    def as_dict(self):
        return dict(self.__dict__)


def record_of(camper, organization):
    attributes = camper.attributes if isinstance(camper.attributes, dict) else {}
    return Record(
        camper=camper.id,
        event=camper.registration.event_id,
        registration=camper.registration_id,
        person=own_person_id(camper, organization),
        name=str(camper),
        first_name=_text(attributes.get('first_name')),
        last_name=_text(attributes.get('last_name')),
        age=_scalar(attributes.get('age')),
        email=_text(attributes.get('email')),
        registrant_email=_text(camper.registration.registrant_email),
    )


def records(organization, events=None):
    return [record_of(camper, organization)
            for camper in included_campers(organization, events)]


# --- Linking ------------------------------------------------------------------------

def _set_person(camper, person):
    # Not an edit of the camper's details: no new version (DR-109), and no repricing.
    camper.person = person
    camper.save_without_recalc(update_fields=['person', 'updated_at'], bump_version=False)


def _lock(organization):
    '''One link at a time in an organization: each reads the people another may change.'''
    models.Organization.objects.select_for_update().filter(pk=organization.pk).first()


def _chosen(organization, camper_ids):
    ids = {int(i) for i in camper_ids}
    campers = list(included_campers(organization).filter(id__in=ids)
                   .select_related('registration__event'))
    if len(campers) != len(ids):
        raise ValidationError(
            {'campers': 'These must be camper records of the included events.'})
    return campers


def _event_clashes(campers):
    '''Messages for each event with more than one of these campers.'''
    def event_of(camper):
        return camper.registration.event
    clashes = []
    for event, group in itertools.groupby(sorted(campers, key=lambda c: event_of(c).id),
                                          key=event_of):
        group = list(group)
        if len(group) > 1:
            names = ' and '.join(str(c) for c in group)
            clashes.append(f'{names} are both in {event.name}; '
                           'a person has one camper record per event.')
    return clashes


def link(organization, camper_ids):
    '''
    Link camper records (and the people they belong to) as one person; returns
    it. Refused when that would put two live records of one event in it.
    '''
    if len(set(camper_ids)) < 2:
        raise ValidationError({'campers': 'Choose at least two camper records to link.'})
    with transaction.atomic():
        _lock(organization)
        chosen = _chosen(organization, camper_ids)
        owned = {c.id: own_person_id(c, organization) for c in chosen}
        person_ids = sorted({p for p in owned.values() if p})
        members = {c.id: c for c in chosen}
        for camper in (_of(organization, models.Camper.objects.filter(person_id__in=person_ids))
                       .select_related('registration__event')):
            members.setdefault(camper.id, camper)
        clashes = _event_clashes(list(members.values()))
        if clashes:
            raise ValidationError({'campers': clashes})

        if person_ids:
            person = models.Person.objects.get(pk=person_ids[0])
        else:
            person = models.Person.objects.create(organization=organization)
        # Every record of the people merged in, live or not, moves to the one kept;
        # so does a chosen record linked to no one here (or to another organization's
        # person, which may be left alone by it).
        movers = list(_of(organization,
                          models.Camper.all_objects.filter(person_id__in=person_ids[1:])))
        elsewhere = [c.person for c in chosen if c.person_id and not owned[c.id]]
        movers += [c for c in chosen if not owned[c.id]]
        for camper in movers:
            _set_person(camper, person)
        for merged in models.Person.objects.filter(pk__in=person_ids[1:]):
            merged.delete()
        for other in elsewhere:
            dissolve_if_alone(other)
        return person


def _of(organization, campers):
    '''Only the campers of the organization's events.'''
    return campers.filter(registration__event__organization=organization)


def dismiss(organization, camper_ids):
    '''
    Record that these camper records aren't all one person: every two of them
    not already linked together won't be suggested as a match again (DR-178).
    '''
    with transaction.atomic():
        _lock(organization)
        chosen = _chosen(organization, camper_ids)
        _dismiss_pairs(organization, chosen)


def _dismiss_pairs(organization, campers):
    for a, b in itertools.combinations(sorted(campers, key=lambda c: c.id), 2):
        if a.person_id and a.person_id == b.person_id:
            continue
        models.PersonMatchDismissal.objects.get_or_create(
            camper_a=a, camper_b=b, defaults={'organization': organization})


def unlink(organization, camper_ids):
    '''
    Take camper records out of their person. One record is then linked to no
    one; two or more stay together, split off as a person of their own (to undo
    a mistaken merge). Either way, they aren't suggested as a match for the
    records left behind again. A person left with one record is dissolved.
    '''
    with transaction.atomic():
        _lock(organization)
        chosen = _chosen(organization, camper_ids)
        person_ids = {own_person_id(c, organization) for c in chosen}
        if None in person_ids:
            raise ValidationError({'campers': 'These aren\'t all linked to someone.'})
        if len(person_ids) > 1:
            raise ValidationError({'campers': 'These are records of different people.'})
        person = chosen[0].person
        ids = {c.id for c in chosen}
        staying = [c for c in _of(organization, models.Camper.objects.filter(person=person))
                   if c.id not in ids]
        if not staying:
            raise ValidationError(
                {'campers': 'These are all of this person\'s records: leave at least one.'})
        split = models.Person.objects.create(organization=organization) \
            if len(chosen) > 1 else None
        for camper in chosen:
            _set_person(camper, split)
        _dismiss_pairs(organization, [*chosen, *staying])
        dissolve_if_alone(person)
        return split


def dissolve_if_alone(person):
    '''Dissolve a person with fewer than two camper records left, deleted ones included.'''
    remaining = list(models.Camper.all_objects.filter(person=person))
    if len(remaining) >= 2:
        return
    for camper in remaining:
        _set_person(camper, None)
    models.Person.objects.filter(pk=person.pk).delete()


@receiver(post_delete, sender=models.Camper)
def _camper_deleted(sender, instance, **kwargs):
    # A link goes with the camper record: a person left alone goes too (DR-179).
    if instance.person_id is None:
        return
    person = models.Person.objects.filter(pk=instance.person_id).first()
    if person is not None:
        dissolve_if_alone(person)

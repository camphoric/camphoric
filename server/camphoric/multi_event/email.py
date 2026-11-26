'''
An organization's email to past campers (SPEC §8.12, DR-182).

Recipients are people across the included events (stats.py): each linked
person once, and each record linked to no one on its own. A person's address is
their newest record's: the camper's own email, else their registrant's. Rules
(the group email rule builder's, DR-45) choose among them by each person's
fields — their attendance, the events of the organization they're registered
for, and their newest record's answers. Like group email, every candidate is a
recipient or skipped with a reason, and the same address goes once.

An address that unsubscribed from the organization's email to past campers, or
from any included event's group email, is skipped. Sending is group email's
(mail/batches.py): a batch of the organization, expanded into outbox copies.
'''

from collections import defaultdict
from dataclasses import asdict, dataclass
from email.utils import formataddr

from django.db import transaction
from django.utils import timezone

from camphoric import models
from camphoric.mail import outbox, unsubscribe
from camphoric.multi_event import people, reports, stats
from camphoric.multi_event.matching import normalize
from camphoric.templating import describe
from camphoric.templating.bulk import Resolution, _Collector
from camphoric.templating.contexts import recipient
from camphoric.templating.emails import render_jinja_email
from camphoric.templating.rules import _field, _flatten, compile_rules, has_rules

Status = models.EmailMessageStatus
BatchStatus = models.EmailBatchStatus


class EmailError(Exception):
    '''The email can't be sent (or tested) as asked.'''


@dataclass
class Entry:
    '''One person who might get the email.'''
    key: str
    name: str
    email: str
    camper: int
    registration: int
    # What the rules read (rules.lookup), as `person.*` and `latest.*`.
    context: dict


def _address(record):
    return record.email or record.registrant_email or ''


def event_labels(organization):
    '''
    Each of the organization's events by id, as rules name it: its name, with
    its year when another event has the same name (and its id if that's not
    enough), so every one can be told apart.
    '''
    events = list(models.Event.objects.filter(organization=organization)
                  .order_by('-start', '-id'))
    names = defaultdict(list)
    for event in events:
        names[event.name].append(event)
    labels = {}
    for name, same in names.items():
        for event in same:
            date = people.event_date(event)
            labels[event.id] = name if len(same) == 1 else \
                f'{name} ({date.year})' if date else f'{name} (#{event.id})'
    counts = defaultdict(int)
    for label in labels.values():
        counts[label] += 1
    return {event.id: (labels[event.id] if counts[labels[event.id]] == 1
                       else f'{event.name} (#{event.id})') for event in events}


def _name(first, last):
    def text(value):
        return normalize(value) if isinstance(value, str) else ''
    return f'{text(first)} {text(last)}'.strip()


def entries(organization):
    '''Everyone across the included events, as rules and the collector see them.'''
    figures = stats.stats(organization)
    included = {row['event']: row for row in figures['events']}
    records = {r.camper: r for r in people.records(organization)}
    labels = event_labels(organization)

    # Every live camper of the organization's events, for who's registered
    # where: by the person a record is linked to, or by the same name at one of
    # the person's addresses (the camper's own, or its registrant's) — a sibling
    # registered under the family's address doesn't count.
    by_person = defaultdict(set)
    by_address = defaultdict(set)
    rows = models.Camper.objects.filter(registration__event__organization=organization) \
        .values_list('person_id', 'attributes', 'registration__registrant_email',
                     'registration__event_id')
    for person_id, attributes, registrant_email, event_id in rows:
        if person_id:
            by_person[person_id].add(event_id)
        attributes = attributes if isinstance(attributes, dict) else {}
        name = _name(attributes.get('first_name'), attributes.get('last_name'))
        for address in (attributes.get('email'), registrant_email):
            if isinstance(address, str) and address.strip():
                by_address[unsubscribe.normalize(address)].add((event_id, name))

    newest = {}
    for row in figures['people']:
        mine = [records[c] for c in row['campers'] if c in records]
        if mine:
            newest[row['key']] = mine
    latest_campers = models.Camper.objects.select_related('registration').in_bulk(
        [mine[-1].camper for mine in newest.values()])

    result = []
    for row in figures['people']:
        mine = newest.get(row['key'])
        latest = latest_campers.get(mine[-1].camper) if mine else None
        if latest is None:
            continue  # gone since the stats were counted
        address = next((_address(r) for r in reversed(mine) if _address(r)), '')
        names = {_name(r.first_name, r.last_name) for r in mine} - {''}
        addresses = {unsubscribe.normalize(a) for r in mine
                     for a in (r.email, r.registrant_email) if a}
        registered = set(row['events']) | {
            event_id for a in addresses for event_id, name in by_address.get(a, ())
            if name in names}
        if row['person']:
            registered |= by_person.get(row['person'], set())
        years = [included[e]['year'] for e in row['events'] if included[e]['year']]
        result.append(Entry(
            key=row['key'], name=row['name'], email=address, camper=latest.id,
            registration=latest.registration_id,
            context={
                'person': {
                    'name': row['name'],
                    'attended': row['attended'],
                    'longest_run': row['longest_run'],
                    'linked': row['person'] is not None,
                    'events': [labels.get(e, included[e]['name']) for e in row['events']],
                    'series': sorted({included[e]['series'] for e in row['events']
                                      if included[e]['series']}),
                    'first_year': min(years) if years else None,
                    'last_year': max(years) if years else None,
                    'registered': sorted(labels[e] for e in registered if e in labels),
                },
                'latest': {
                    'camper': {'attributes': latest.attributes or {},
                               'admin_attributes': latest.admin_attributes or {}},
                    'registration': {
                        'attributes': latest.registration.attributes or {},
                        'registrant_email': latest.registration.registrant_email,
                    },
                },
            }))
    result.sort(key=lambda e: (e.name.lower(), e.key))
    return result


def unsubscribed(organization):
    '''Addresses unsubscribed from the organization's email, or an included event's.'''
    own = models.OrganizationUnsubscribe.objects.filter(organization=organization)
    events = models.EmailUnsubscribe.objects.filter(
        event__organization=organization, event__multi_event__included=True)
    return set(own.values_list('email', flat=True)) | set(events.values_list('email', flat=True))


def resolve(organization, filter_, *, only_keys=None):
    '''
    Who the rules reach: a group email Resolution (recipients, skipped,
    diagnostics; `missing` with `only_keys`), and the entries by key. With
    `only_keys` — a send's reviewed recipients — the rules aren't applied again,
    only who's still there and still reachable.
    '''
    result_entries = {e.key: e for e in entries(organization)}
    collector = _Collector(unsubscribed(organization))
    if only_keys is not None:
        wanted = list(dict.fromkeys(only_keys))
        chosen = [result_entries[k] for k in wanted if k in result_entries]
        collector.result.missing = [k for k in wanted if k not in result_entries]
    else:
        predicate, problems = compile_rules(filter_)
        if problems:
            return Resolution(diagnostics=problems), result_entries
        chosen = [e for e in result_entries.values() if predicate(e.context)]
    for entry in chosen:
        collector.add(entry.email, entry.name, entry.name, key=entry.key,
                      camper=entry.camper, registration=entry.registration)
    return collector.result, result_entries


def recipient_fields(organization):
    '''The fields people can be chosen by, for the rule builder.'''
    figures = stats.stats(organization)
    labels = event_labels(organization)
    event_names = [labels.get(row['event'], row['name']) for row in figures['events']]
    every_event = list(labels.values())
    fields = [
        _field('person.name', 'Name', 'Person', 'string'),
        _field('person.attended', 'Included events attended', 'Person', 'number'),
        _field('person.events', 'Included events', 'Person', 'list', event_names),
        _field('person.series', 'Series', 'Person', 'list', figures['series']),
        _field('person.first_year', 'First year', 'Person', 'number'),
        _field('person.last_year', 'Most recent year', 'Person', 'number'),
        _field('person.longest_run', 'Most consecutive years', 'Person', 'number'),
        _field('person.linked', 'Records linked', 'Person', 'boolean'),
        _field('person.registered', 'Registered for (any event)', 'Person', 'list',
               every_event),
        _field('latest.registration.registrant_email', 'Registrant email', 'Latest record',
               'string'),
    ]
    newest = people.included_events(organization)
    if newest:
        types = describe.event_types(newest[-1])
        fields += [
            *_flatten(types, 'attributes:camper', 'latest.camper.attributes',
                      'Latest camper answers'),
            *_flatten(types, 'admin_attributes:camper', 'latest.camper.admin_attributes',
                      'Latest camper admin fields'),
            *_flatten(types, 'attributes:registration', 'latest.registration.attributes',
                      'Latest registration answers'),
        ]
    return fields


def filter_errors(filter_):
    '''A filter's problems as `{filter: [...]}`, for a 400; none for none.'''
    if not has_rules(filter_) and filter_ in (None, '', {}):
        return {}
    _, problems = compile_rules(filter_)
    return {'filter': [p.message for p in problems]} if problems else {}


# --- Rendering ---------------------------------------------------------------------

def email_context(variables, person, to):
    '''One copy's variables (`multi_event_email`), from report_context's.'''
    return {
        'organization_name': variables['organization_name'],
        'events': variables['events'],
        'person': person,
        'recipient': to,
        'today': variables['today'],
        'now': variables['now'],
    }


def people_by_key(variables):
    return {person['id']: person for person in variables['people']}


# --- Sending -----------------------------------------------------------------------

@dataclass
class Sent:
    '''Who an email has already reached: by person, and by address.'''
    keys: set
    addresses: set

    def __contains__(self, candidate):
        # A person's key changes when their records are linked or unlinked; the
        # address a copy went to doesn't, so either one counts.
        return candidate.key in self.keys or \
            unsubscribe.normalize(candidate.email) in self.addresses


def sent_to(organization_email_id, *, exclude_batch=None):
    '''Who an email has already been sent to.'''
    sent = models.EmailMessage.objects.filter(
        batch__organization_email_id=organization_email_id, status=Status.SENT)
    if exclude_batch is not None:
        sent = sent.exclude(batch=exclude_batch)
    rows = list(sent.values_list('recipient_key', 'to'))
    return Sent(keys={key for key, _ in rows},
                addresses={unsubscribe.normalize(to) for _, to in rows})


SAVED = object()


def create_batch(email, *, recipient_keys, account=SAVED, from_email='', reply_to=SAVED,
                 skip_already_sent=True, send_at=None, created_by=None, link_base=''):
    '''
    Record a send of `email` to the reviewed people and schedule it (as
    batches.create_batch). The account and Reply-To are the email's unless
    given — an account of None is the server's default mailer, and a blank
    Reply-To the account's default.
    '''
    from camphoric.mail.tasks import expand_batch

    keys = list(dict.fromkeys(k for k in recipient_keys if isinstance(k, str) and k))
    if not keys:
        raise EmailError('Choose at least one recipient.')
    sender = from_email or email.from_email
    if not sender:
        raise EmailError('Give the address the email is from.')
    later = send_at is not None and send_at > timezone.now()
    task = expand_batch.using(run_after=send_at) if later else expand_batch
    if later and not task.get_backend().supports_defer:
        raise EmailError('Sending later needs the email worker (CAMPHORIC_EMAIL_QUEUE=worker).')
    batch = models.EmailBatch.objects.create(
        organization=email.organization, organization_email=email, name=email.name,
        subject=email.subject, body=email.body, filter=email.filter, recipient_keys=keys,
        account=email.account if account is SAVED else account, from_email=sender,
        reply_to=email.reply_to if reply_to is SAVED else reply_to,
        skip_already_sent=skip_already_sent,
        send_at=send_at if later else None, created_by=created_by, link_base=link_base)
    task.enqueue(batch.id)
    batch.refresh_from_db()
    return batch


def _copy(batch, variables, everyone, candidate):
    '''Render one person's copy: (fields, rendered).'''
    organization = batch.organization
    to = formataddr((candidate.name, candidate.email)) if candidate.name else candidate.email
    rendered = render_jinja_email(
        batch.subject, batch.body,
        email_context(variables, everyone[candidate.key],
                      recipient(candidate.email, candidate.name)))
    text, html = rendered.text, rendered.html
    link = unsubscribe.organization_unsubscribe_url(
        batch.link_base, organization.id, candidate.email)
    if link:
        text_footer, html_footer = unsubscribe.organization_footer(organization.name, link)
        text, html = text + text_footer, (html + html_footer if html else '')
    fields = dict(
        event=None, organization=organization, kind=models.EmailMessageKind.MULTI_EVENT,
        to=to, subject=rendered.subject or batch.subject, text=text, html=html,
        unsubscribe_url=link, from_email=batch.from_email, account=batch.account,
        reply_to=batch.reply_to or None, batch=batch, recipient_key=candidate.key,
        created_by=batch.created_by, dedupe_key=f'batch:{batch.id}:{candidate.key}')
    return fields, rendered


def expand(batch):
    '''Render and queue one copy per person of a claimed organization batch.'''
    organization = batch.organization
    resolution, found = resolve(organization, batch.filter, only_keys=batch.recipient_keys)
    key_of = {entry.camper: key for key, entry in found.items()}
    skipped = [{'key': key, 'label': key, 'reason': 'gone'} for key in resolution.missing]
    skipped += [{**asdict(s), 'key': key_of.get(s.camper, '')} for s in resolution.skipped]
    already = (sent_to(batch.organization_email_id, exclude_batch=batch)
               if batch.skip_already_sent and batch.organization_email_id
               else Sent(set(), set()))
    variables = reports.report_context(organization)
    everyone = people_by_key(variables)

    queued = 0
    with transaction.atomic():
        for candidate in resolution.recipients:
            if candidate in already:
                skipped.append({'key': candidate.key, 'label': candidate.label,
                                'reason': 'already_sent'})
                continue
            if candidate.key not in everyone:
                skipped.append({'key': candidate.key, 'label': candidate.label,
                                'reason': 'gone'})
                continue
            fields, rendered = _copy(batch, variables, everyone, candidate)
            if rendered.ok:
                message = outbox.enqueue(**fields)
                queued += message.status == Status.QUEUED
            else:
                problem = rendered.errors[0]
                where = f'{problem.field} line {problem.line}: ' if problem.line else ''
                fields['reply_to'] = fields['reply_to'] or outbox.default_reply_to(
                    fields['account'], fields['from_email'])
                models.EmailMessage.objects.create(
                    **fields, status=Status.FAILED,
                    last_error=f"The email couldn't be rendered for this recipient "
                               f'({where}{problem.message})')
        batch.skipped = skipped
        batch.save(update_fields=['skipped', 'updated_at'])
        still_expanding = (models.EmailBatch.objects
                           .filter(id=batch.id, status=BatchStatus.EXPANDING)
                           .update(status=BatchStatus.SENDING, updated_at=timezone.now()))
        if not still_expanding:
            # Cancelled while it was being prepared: nothing goes out.
            models.EmailMessage.objects.filter(batch=batch, status=Status.QUEUED).update(
                status=Status.CANCELLED, last_error='Cancelled', updated_at=timezone.now())
            return 'cancelled'
    return f'queued {queued}'


def send_test(email, *, to, recipient_key=None, subject=None, body=None, filter_=None,
              created_by=None):
    '''
    Queue one copy of `email` (or its unsaved subject, body and rules), rendered
    for a person — `recipient_key`, else the first the rules reach — to `to`,
    marked [Test]. Returns (message or None, rendered, candidate).
    '''
    organization = email.organization
    resolution, _ = resolve(organization, email.filter if filter_ is None else filter_)
    if not resolution.ok:
        return None, None, None
    candidates = resolution.recipients
    chosen = (next((c for c in candidates if c.key == recipient_key), None) if recipient_key
              else (candidates[0] if candidates else None))
    if chosen is None:
        raise EmailError('There is no such recipient to render the test for.'
                         if recipient_key else 'The recipients list is empty.')
    variables = reports.report_context(organization)
    person = people_by_key(variables).get(chosen.key)
    if person is None:
        raise EmailError('There is no such recipient to render the test for.')
    rendered = render_jinja_email(
        email.subject if subject is None else subject, email.body if body is None else body,
        email_context(variables, person, recipient(chosen.email, chosen.name)))
    if not rendered.ok:
        return None, rendered, chosen
    if not email.from_email:
        raise EmailError('Give the address the email is from.')
    message = outbox.enqueue(
        event=None, organization=organization, kind=models.EmailMessageKind.TEST, to=to,
        subject=f'[Test] {rendered.subject}', text=rendered.text, html=rendered.html,
        from_email=email.from_email, account=email.account, reply_to=email.reply_to or None,
        created_by=created_by)
    return message, rendered, chosen

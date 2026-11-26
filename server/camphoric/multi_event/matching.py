'''
Suggested matches: camper records in different included events that are likely
one person (SPEC §8.12, DR-178). They're only proposals: nothing is linked
until an organizer accepts one.

Records are compared by what every camp's camper schema has: first and last
name, the camper's email and the registrant's email (no camp asks for a
birthdate, and age is a bracket). A person's linked records count as one, and
two records in the same event are never the same person. Each pair of records
that may be one person gets a level:

- `strong`: the same name, and an email in common.
- `likely`: the same name; or the same first name and the camper's own email
  in common (a changed last name).
- `possible`: a nickname or a one-letter difference in a name, with the other
  name the same; or the same first name and the registrant's email in common.

A pair is dropped when its ages (as numbers, or a bracket's first number) go
down from an earlier event to a later one, or an organizer dismissed it.
Pairs are then gathered into suggestions, strongest first, as long as each
suggestion has one record per event: a suggestion is as strong as its weakest
pair.
'''

from collections import defaultdict
from dataclasses import dataclass, field
import itertools
import re
import unicodedata

from camphoric import models
from camphoric.multi_event import people

STRONG, LIKELY, POSSIBLE = 3, 2, 1
LEVELS = {STRONG: 'strong', LIKELY: 'likely', POSSIBLE: 'possible'}
_RANK = {name: level for level, name in LEVELS.items()}

# Common English nicknames, each group one name.
NICKNAMES = [
    ('william', 'will', 'bill', 'billy', 'willy', 'liam'),
    ('robert', 'rob', 'bob', 'bobby', 'robbie', 'bert'),
    ('richard', 'rich', 'rick', 'ricky', 'dick'),
    ('james', 'jim', 'jimmy', 'jamie'),
    ('john', 'jack', 'johnny', 'jon'),
    ('jonathan', 'jon', 'jonny'),
    ('michael', 'mike', 'mikey', 'mick', 'mickey'),
    ('thomas', 'tom', 'tommy'),
    ('christopher', 'chris', 'kit'),
    ('christine', 'chris', 'chrissy', 'christina', 'tina'),
    ('daniel', 'dan', 'danny'),
    ('david', 'dave', 'davey'),
    ('joseph', 'joe', 'joey'),
    ('charles', 'charlie', 'chuck', 'chas'),
    ('edward', 'ed', 'eddie', 'ted', 'teddy', 'ned'),
    ('anthony', 'tony'),
    ('andrew', 'andy', 'drew'),
    ('matthew', 'matt'),
    ('nicholas', 'nick', 'nicky', 'nico'),
    ('benjamin', 'ben', 'benny', 'benji'),
    ('samuel', 'sam', 'sammy'),
    ('samantha', 'sam', 'sammy'),
    ('alexander', 'alex', 'al', 'sandy', 'xander'),
    ('alexandra', 'alex', 'alexa', 'sandra', 'sandy', 'lexi'),
    ('steven', 'stephen', 'steve', 'stevie'),
    ('timothy', 'tim', 'timmy'),
    ('patrick', 'pat', 'paddy'),
    ('patricia', 'pat', 'patty', 'trish', 'tricia'),
    ('peter', 'pete'),
    ('gregory', 'greg'),
    ('jeffrey', 'jeff', 'geoffrey'),
    ('kenneth', 'ken', 'kenny'),
    ('ronald', 'ron', 'ronnie'),
    ('donald', 'don', 'donnie'),
    ('lawrence', 'larry', 'laurence'),
    ('leonard', 'leo', 'len', 'lenny'),
    ('frederick', 'fred', 'freddie'),
    ('elizabeth', 'liz', 'lizzie', 'beth', 'betsy', 'betty', 'eliza', 'libby', 'lisa'),
    ('margaret', 'maggie', 'meg', 'peggy', 'marge', 'greta'),
    ('katherine', 'catherine', 'kathryn', 'kate', 'katie', 'kathy', 'cathy', 'kat', 'kay'),
    ('jennifer', 'jen', 'jenny'),
    ('jessica', 'jess', 'jessie'),
    ('rebecca', 'becca', 'becky'),
    ('susan', 'sue', 'susie', 'suzanne'),
    ('deborah', 'debra', 'deb', 'debbie'),
    ('barbara', 'barb', 'babs'),
    ('victoria', 'vicky', 'tori'),
    ('abigail', 'abby', 'gail'),
    ('rosemary', 'rose', 'rosie'),
    ('theodore', 'theo', 'ted', 'teddy'),
    ('zachary', 'zach', 'zack'),
    ('nathaniel', 'nathan', 'nate', 'nat'),
    ('eleanor', 'ellie', 'nell', 'nora', 'elle'),
    ('josephine', 'jo', 'josie'),
    ('joshua', 'josh'),
    ('gabriel', 'gabe'),
    ('gabriella', 'gabrielle', 'gabby'),
    ('isabella', 'isabel', 'izzy', 'bella'),
    ('madeline', 'madeleine', 'maddie', 'maddy'),
    ('penelope', 'penny'),
    ('virginia', 'ginny', 'ginger'),
    ('dorothy', 'dot', 'dottie', 'dolly'),
    ('frances', 'fran', 'frankie'),
    ('francis', 'frank', 'frankie'),
    ('douglas', 'doug'),
    ('raymond', 'ray'),
    ('gerald', 'gerry', 'jerry'),
    ('jacob', 'jake'),
    ('judith', 'judy'),
    ('cynthia', 'cindy'),
    ('pamela', 'pam'),
    ('melissa', 'mel', 'missy'),
    ('amanda', 'mandy'),
    ('kimberly', 'kim'),
    ('stephanie', 'steph'),
    ('valerie', 'val'),
]

_NICKNAME_GROUPS = defaultdict(set)
for _index, _group in enumerate(NICKNAMES):
    for _name in _group:
        _NICKNAME_GROUPS[_name].add(_index)


def normalize(text):
    '''Lower case, without accents or punctuation, single-spaced.'''
    if not text:
        return ''
    text = unicodedata.normalize('NFKD', text)
    text = ''.join(c for c in text if not unicodedata.combining(c)).lower()
    return ' '.join(re.sub(r"[^a-z0-9]+", ' ', text.replace("'", '')).split())


def normalize_email(address):
    return address.strip().lower() if address else ''


def nicknames(a, b):
    '''Whether two first names are the same name, one a nickname of the other.'''
    return a != b and bool(_NICKNAME_GROUPS[a] & _NICKNAME_GROUPS[b])


def one_letter_apart(a, b):
    '''One letter added, dropped, changed, or two side by side swapped; names of 4+ letters.'''
    if a == b or min(len(a), len(b)) < 4 or abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        diffs = [i for i in range(len(a)) if a[i] != b[i]]
        if len(diffs) == 1:
            return True
        return (len(diffs) == 2 and diffs[1] == diffs[0] + 1
                and a[diffs[0]] == b[diffs[1]] and a[diffs[1]] == b[diffs[0]])
    shorter, longer = sorted((a, b), key=len)
    i = 0
    while i < len(shorter) and shorter[i] == longer[i]:
        i += 1
    return shorter[i:] == longer[i + 1:]


def age_number(age):
    '''An age, or the first number of a bracket ("26-49 years old" is 26); None for none.'''
    if not age:
        return None
    found = re.search(r'\d+', age)
    return int(found.group()) if found else None


@dataclass
class Entry:
    '''A camper record as the matcher sees it.'''
    record: people.Record
    order: int  # the event's place in time
    first: str
    last: str
    email: str
    registrant_email: str
    age: int | None

    @property
    def camper(self):
        return self.record.camper


def _entries(records, events):
    order = {event.id: index for index, event in enumerate(people.chronological(events))}
    return [Entry(record=r, order=order[r.event], first=normalize(r.first_name),
                  last=normalize(r.last_name), email=normalize_email(r.email),
                  registrant_email=normalize_email(r.registrant_email), age=age_number(r.age))
            for r in records]


def incompatible(a, b):
    '''Whether two records can't be one person: they're in one event, or ages go down.'''
    if a.record.event == b.record.event:
        return True
    earlier, later = sorted((a, b), key=lambda e: e.order)
    return earlier.age is not None and later.age is not None and later.age < earlier.age


def compare(a, b):
    '''The level at which two records may be one person, and why; (None, []) for no match.'''
    if incompatible(a, b):
        return None, []
    if not (a.first or a.last) or not (b.first or b.last):
        return None, []

    same_first = a.first and a.first == b.first
    same_last = a.last and a.last == b.last
    own_email = a.email and a.email in (b.email, b.registrant_email) or \
        b.email and b.email in (a.email, a.registrant_email)
    registrant_email = a.registrant_email and a.registrant_email == b.registrant_email
    shared_email = own_email or registrant_email

    if same_first and same_last:
        if shared_email:
            return STRONG, ['same_name', 'same_email']
        return LIKELY, ['same_name']
    if same_first and own_email:
        return LIKELY, ['same_first_name', 'same_email']
    if same_last and (nicknames(a.first, b.first) or one_letter_apart(a.first, b.first)):
        reason = 'nickname' if nicknames(a.first, b.first) else 'similar_first_name'
        return POSSIBLE, [reason, 'same_last_name'] + (['same_email'] if shared_email else [])
    if same_first and one_letter_apart(a.last, b.last):
        return POSSIBLE, ['same_first_name', 'similar_last_name'] + (
            ['same_email'] if shared_email else [])
    if same_first and registrant_email:
        return POSSIBLE, ['same_first_name', 'same_registrant_email']
    return None, []


def _candidate_pairs(entries):
    '''The pairs worth comparing: those sharing a last name, a first name (or its nicknames'
    group) or an email.'''
    buckets = defaultdict(list)
    for entry in entries:
        if entry.last:
            buckets['last', entry.last].append(entry)
        if entry.first:
            buckets['first', entry.first].append(entry)
            for group in _NICKNAME_GROUPS[entry.first]:
                buckets['nick', group].append(entry)
        for address in {entry.email, entry.registrant_email} - {''}:
            buckets['email', address].append(entry)
    seen = set()
    for bucket in buckets.values():
        for a, b in itertools.combinations(bucket, 2):
            key = (min(a.camper, b.camper), max(a.camper, b.camper))
            if key not in seen:
                seen.add(key)
                yield a, b


@dataclass
class Group:
    '''Records believed to be one person: a person's records, or one unlinked record.'''
    entries: list
    events: set = field(default_factory=set)
    level: int = STRONG
    reasons: set = field(default_factory=set)
    merged: bool = False


def suggestions(organization):
    '''The suggested matches among the organization's included events, strongest first.'''
    events = people.included_events(organization)
    # The records of these events, not of events included since they were read.
    entries = _entries(people.records(organization, events), events)
    dismissed = set(models.PersonMatchDismissal.objects.filter(organization=organization)
                    .values_list('camper_a', 'camper_b'))

    # Start from each person (their records together) and each unlinked record.
    groups = {}
    group_of = {}
    for entry in entries:
        key = ('person', entry.record.person) if entry.record.person else ('camper', entry.camper)
        group = groups.setdefault(key, Group(entries=[]))
        group.entries.append(entry)
        group.events.add(entry.record.event)
        group_of[entry.camper] = group

    pairs = []
    for a, b in _candidate_pairs(entries):
        if group_of[a.camper] is group_of[b.camper]:
            continue
        if (min(a.camper, b.camper), max(a.camper, b.camper)) in dismissed:
            continue
        level, reasons = compare(a, b)
        if level:
            pairs.append((level, a, b, reasons))
    pairs.sort(key=lambda p: (-p[0], sorted((p[1].camper, p[2].camper))))

    def kept_apart(x, y):
        # Every record of one may be the same person as every record of the other.
        return any((min(i.camper, j.camper), max(i.camper, j.camper)) in dismissed
                   or incompatible(i, j)
                   for i in x.entries for j in y.entries)

    for level, a, b, reasons in pairs:
        x, y = group_of[a.camper], group_of[b.camper]
        if x is y or kept_apart(x, y):
            continue
        x.entries += y.entries
        x.events |= y.events
        x.level = min(x.level, y.level if y.merged else STRONG, level)
        x.reasons |= y.reasons | set(reasons)
        x.merged = True
        for entry in y.entries:
            group_of[entry.camper] = x
        y.entries = []

    found = []
    for group in {id(g): g for g in group_of.values()}.values():
        if not group.merged:
            continue
        ordered = sorted(group.entries, key=lambda e: (e.order, e.camper))
        found.append({
            'campers': [e.camper for e in ordered],
            'people': sorted({e.record.person for e in ordered if e.record.person}),
            'level': LEVELS[group.level],
            'reasons': sorted(group.reasons),
            'name': ordered[-1].record.name,
        })
    found.sort(key=lambda s: (-_RANK[s['level']], normalize(s['name']), s['campers'][0]))
    return found

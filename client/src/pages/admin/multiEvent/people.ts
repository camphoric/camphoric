/**
 * Multi-event records grouped as people (SPEC §8.12): a person's linked camper
 * records together, and each record linked to no one on its own. Events are
 * put in time order the way the server orders them (their start, else their
 * opening; undated last).
 */

import type { ApiMultiEventCamper, ApiMultiEventEvent, MatchReason } from 'api-types';

/** A person, or one record linked to no one. */
export interface PersonUnit {
  /** `person:<id>`, or `camper:<id>` for a record linked to no one. */
  key: string;
  person: number | null;
  /** Their records, oldest event first. */
  records: ApiMultiEventCamper[];
  /** The name on their newest record. */
  name: string;
  /** Every name and address they're recorded under, for searching. */
  names: string[];
  emails: string[];
  /** The age on their newest record that has one. */
  age: string | null;
  /** Events with more than one of their records, which linking shouldn't allow. */
  clashes: number[];
}

function eventDate(event: ApiMultiEventEvent): string | null {
  return event.start ?? event.registration_start?.slice(0, 10) ?? null;
}

/** Each event's place in time, oldest first, by id. */
export function chronologicalOrder(events: ApiMultiEventEvent[]): Map<number, number> {
  const sorted = [...events].sort((a, b) => {
    const da = eventDate(a);
    const db = eventDate(b);
    if (da === db) return a.event - b.event;
    if (da === null) return 1;
    if (db === null) return -1;
    return da < db ? -1 : 1;
  });
  return new Map(sorted.map((event, index) => [event.event, index]));
}

export function unitKey(record: ApiMultiEventCamper): string {
  return record.person ? `person:${record.person}` : `camper:${record.camper}`;
}

export function groupPeople(
  records: ApiMultiEventCamper[],
  events: ApiMultiEventEvent[],
): PersonUnit[] {
  const order = chronologicalOrder(events);
  const place = (record: ApiMultiEventCamper) => order.get(record.event) ?? Infinity;
  const grouped = new Map<string, ApiMultiEventCamper[]>();
  for (const record of records) {
    const key = unitKey(record);
    grouped.set(key, [...(grouped.get(key) ?? []), record]);
  }
  return [...grouped.entries()].map(([key, mine]) => {
    mine.sort((a, b) => place(a) - place(b) || a.camper - b.camper);
    const newest = mine[mine.length - 1];
    const counts = new Map<number, number>();
    for (const record of mine) counts.set(record.event, (counts.get(record.event) ?? 0) + 1);
    const unique = (values: (string | null)[]) => [
      ...new Set(values.filter((v): v is string => !!v)),
    ];
    return {
      key,
      person: newest.person,
      records: mine,
      name: newest.name,
      names: unique(mine.map((r) => r.name)),
      emails: unique(mine.flatMap((r) => [r.email, r.registrant_email])),
      age: [...mine].reverse().find((r) => r.age)?.age ?? null,
      clashes: [...counts].filter(([, count]) => count > 1).map(([event]) => event),
    };
  });
}

/** The events two or more of these people were both at: they can't be one person. */
export function sharedEvents(units: PersonUnit[]): number[] {
  const seen = new Set<number>();
  const shared = new Set<number>();
  for (const unit of units) {
    for (const event of new Set(unit.records.map((r) => r.event))) {
      if (seen.has(event)) shared.add(event);
      seen.add(event);
    }
  }
  return [...shared];
}

// In the order they're told.
const REASONS: Record<MatchReason, string> = {
  same_name: 'same name',
  same_first_name: 'same first name',
  nickname: 'a nickname',
  similar_first_name: 'first names a letter apart',
  same_last_name: 'same last name',
  similar_last_name: 'last names a letter apart',
  same_email: 'an email in common',
  same_registrant_email: 'same registrant email',
};

const REASON_ORDER = Object.keys(REASONS);

/** Why records were suggested as one person, in words: names first, then addresses. */
export function describeReasons(reasons: MatchReason[]): string {
  const words = [...reasons]
    .sort((a, b) => REASON_ORDER.indexOf(a) - REASON_ORDER.indexOf(b))
    .map((reason) => REASONS[reason] ?? reason);
  if (words.length <= 1) return capitalize(words[0] ?? '');
  return capitalize(`${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

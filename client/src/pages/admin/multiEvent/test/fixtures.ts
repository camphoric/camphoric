/**
 * Sample multi-event data (SPEC §8.12) for the area's tests and stories: three
 * years of a camp and a campout, with one person linked across them, records
 * linked to no one, and suggested matches.
 */

import type {
  ApiMultiEventCamper,
  ApiMultiEventEvent,
  ApiMultiEventStatsEvent,
  ApiPersonSuggestion,
} from 'api-types';

function event(
  id: number,
  name: string,
  year: number,
  series: string,
  included = true,
): ApiMultiEventEvent {
  return {
    event: id,
    name,
    start: `${year}-07-01`,
    end: `${year}-07-08`,
    registration_start: `${year}-02-01T08:00:00Z`,
    included,
    series,
  };
}

/** In the event chooser's order: newest first. */
export const EVENTS: ApiMultiEventEvent[] = [
  event(4, 'Lark Camp 2025', 2025, 'Lark Camp'),
  event(3, 'Lark Campout 2024', 2024, 'Campout'),
  event(2, 'Lark Camp 2024', 2024, 'Lark Camp'),
  event(1, 'Lark Camp 2023', 2023, 'Lark Camp'),
  event(5, 'Lark Camp 2022', 2022, '', false),
];

export const EVENTS_BY_ID = new Map(EVENTS.map((e) => [e.event, e]));

function record(
  camper: number,
  eventId: number,
  name: string,
  extra: Partial<ApiMultiEventCamper> = {},
): ApiMultiEventCamper {
  const [first, last] = name.split(' ');
  return {
    camper,
    event: eventId,
    registration: camper + 100,
    person: null,
    name,
    first_name: first,
    last_name: last,
    age: '26-49 years old',
    email: null,
    registrant_email: `${last.toLowerCase()}@example.com`,
    ...extra,
  };
}

export const RECORDS: ApiMultiEventCamper[] = [
  // Ann Lee, linked across three events.
  record(11, 1, 'Ann Lee', { person: 7, email: 'ann@example.com' }),
  record(12, 2, 'Ann Lee', { person: 7 }),
  record(13, 4, 'Annie Lee', { person: 7, age: '50-64 years old' }),
  // Bo Ng, not linked yet.
  record(21, 1, 'Bo Ng'),
  record(22, 3, 'Bo Ng'),
  record(23, 4, 'Bo Ng'),
  // Cy Day, once.
  record(31, 2, 'Cy Day', { age: '12-17 years old' }),
  // Bill Hart and William Hart, maybe one person.
  record(41, 2, 'William Hart'),
  record(42, 4, 'Bill Hart'),
];

export const RECORDS_BY_ID = new Map(RECORDS.map((r) => [r.camper, r]));

export const SUGGESTIONS: ApiPersonSuggestion[] = [
  {
    campers: [21, 22, 23],
    people: [],
    level: 'strong',
    reasons: ['same_email', 'same_name'],
    name: 'Bo Ng',
  },
  {
    campers: [41, 42],
    people: [],
    level: 'possible',
    reasons: ['nickname', 'same_last_name'],
    name: 'Bill Hart',
  },
];

export const STATS_EVENTS: ApiMultiEventStatsEvent[] = [
  {
    event: 1,
    name: 'Lark Camp 2023',
    series: 'Lark Camp',
    date: '2023-07-01',
    year: 2023,
    campers: 2,
    registrations: 2,
    people: 2,
    new: 2,
    returning: 0,
    previous: null,
    received: '1250.00',
  },
  {
    event: 2,
    name: 'Lark Camp 2024',
    series: 'Lark Camp',
    date: '2024-07-01',
    year: 2024,
    campers: 3,
    registrations: 3,
    people: 3,
    new: 2,
    returning: 1,
    previous: { event: 1, name: 'Lark Camp 2023', people: 2, returned: 1 },
    received: '0.00',
  },
];

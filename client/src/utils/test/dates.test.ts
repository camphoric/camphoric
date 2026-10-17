import { Settings } from 'luxon';
import { afterEach, describe, expect, it } from 'vitest';

import {
  dateStringToParts,
  eventDays,
  isoToLocalDateTime,
  keepClockTimeInZone,
  localDateTimeToIso,
  timeZoneName,
} from '../dates';

describe('dateStringToParts', () => {
  it('splits a YYYY-MM-DD string without local-zone drift', () => {
    expect(dateStringToParts('2026-06-29')).toEqual({ year: 2026, month: 6, day: 29 });
  });
});

describe('eventDays', () => {
  it('lists every day inclusive of start and end', () => {
    expect(eventDays('2026-07-01', '2026-07-04')).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
    ]);
  });

  it('returns a single day when start equals end', () => {
    expect(eventDays('2026-07-01', '2026-07-01')).toEqual(['2026-07-01']);
  });

  it('returns empty for an inverted range', () => {
    expect(eventDays('2026-07-04', '2026-07-01')).toEqual([]);
  });

  it('returns empty while either date is unset', () => {
    expect(eventDays(null, '2026-07-01')).toEqual([]);
    expect(eventDays('2026-07-01', null)).toEqual([]);
  });
});

describe('local date-times', () => {
  it('round-trips an ISO instant through a DateTimePicker value', () => {
    const iso = new Date(2026, 9, 1, 9, 30, 0).toISOString();
    expect(isoToLocalDateTime(iso)).toBe('2026-10-01 09:30:00');
    expect(localDateTimeToIso('2026-10-01 09:30:00')).toBe(iso);
    expect(localDateTimeToIso('2026-10-01 09:30')).toBe(iso);
  });
});

describe('date-times in a time zone', () => {
  // A browser in Tokyo, working with a camp in California.
  afterEach(() => {
    Settings.defaultZone = 'system';
  });

  it('shows an instant at its clock time in the zone, not the browser’s', () => {
    Settings.defaultZone = 'Asia/Tokyo';
    expect(isoToLocalDateTime('2026-12-13T22:00:00Z', 'America/Los_Angeles')).toBe(
      '2026-12-13 14:00:00',
    );
  });

  it('reads a picked clock time as that time in the zone', () => {
    Settings.defaultZone = 'Asia/Tokyo';
    expect(localDateTimeToIso('2026-12-13 14:00:00', 'America/Los_Angeles')).toBe(
      '2026-12-13T22:00:00.000Z',
    );
    // Daylight time: 2 PM in July is 21:00 UTC.
    expect(localDateTimeToIso('2026-07-01 14:00', 'America/Los_Angeles')).toBe(
      '2026-07-01T21:00:00.000Z',
    );
  });

  it('keeps the clock time when the zone changes', () => {
    expect(
      keepClockTimeInZone('2026-12-13T22:00:00Z', 'America/Los_Angeles', 'America/New_York'),
    ).toBe('2026-12-13T19:00:00.000Z');
  });

  it('names a zone the everyday way', () => {
    expect(timeZoneName('America/Los_Angeles')).toBe('Pacific Time');
    expect(timeZoneName('Not/AZone')).toBe('Not/AZone');
  });
});

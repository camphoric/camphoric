import { describe, expect, it } from 'vitest';

import { dateStringToParts, eventDays, isoToLocalDateTime, localDateTimeToIso } from '../dates';

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
});

describe('local date-times', () => {
  it('round-trips an ISO instant through a DateTimePicker value', () => {
    const iso = new Date(2026, 9, 1, 9, 30, 0).toISOString();
    expect(isoToLocalDateTime(iso)).toBe('2026-10-01 09:30:00');
    expect(localDateTimeToIso('2026-10-01 09:30:00')).toBe(iso);
    expect(localDateTimeToIso('2026-10-01 09:30')).toBe(iso);
  });
});

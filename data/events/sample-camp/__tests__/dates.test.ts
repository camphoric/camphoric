/**
 * Sample Camp's dates are worked out from today: camp starts on the next
 * August 1st at least a month away, and registration is always open until the
 * day before, so the sample registrations can be posted whenever it's
 * imported.
 */

import { afterEach, describe, expect, jest, test } from '@jest/globals';

// dates.ts reads the clock when it loads, so each case loads a fresh copy
async function datesOn(now: string) {
  jest.useFakeTimers({ now: new Date(now) });
  jest.resetModules();
  return import(`../dates.ts?now=${encodeURIComponent(now)}`);
}

afterEach(() => {
  jest.useRealTimers();
});

describe('dates', () => {
  test.each([
    ['2027-01-15T12:00:00Z', 2027],
    ['2027-06-29T12:00:00Z', 2027],
    // the cut-off is midnight in the camp's time zone (Pacific), not UTC
    ['2027-06-30T03:00:00Z', 2027], // June 29th, 8 pm in Pacific time
    ['2027-06-30T07:00:00Z', 2028], // June 30th, midnight in Pacific time
    ['2027-07-01T12:00:00Z', 2028],
    ['2027-12-31T12:00:00Z', 2028],
  ])('on %s, camp is in %i', async (now, year) => {
    const { dates, year: campYear, lengthInDays } = await datesOn(now);
    expect(campYear).toBe(year);
    expect(dates.start.toISODate()).toBe(`${year}-08-01`);
    expect(dates.end.diff(dates.start, 'days').days).toBe(lengthInDays);
    expect(dates.registration_end.toISODate()).toBe(`${year}-07-31`);
  });

  test('registration is open now, and closes before camp starts', async () => {
    const { dates } = await datesOn('2027-03-01T12:00:00Z');
    const now = Date.now();
    expect(dates.registration_start.toMillis()).toBeLessThan(now);
    expect(dates.registration_end.toMillis()).toBeGreaterThan(now);
    expect(dates.registration_end < dates.start).toBe(true);
  });
});

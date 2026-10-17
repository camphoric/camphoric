import { DateTime } from 'luxon';

/**
 * Sample Camp's dates. They are worked out from today, so they stay valid
 * without editing, and change only once a year:
 *
 * - camp starts on the next August 1st that is at least a month away (this
 *   year's until June 30th, then next year's), and runs for `lengthInDays`;
 * - registration opened long ago, so the sample registrations can always be
 *   posted, and closes the day before camp.
 */

export const zone = 'America/Los_Angeles';

export const lengthInDays = 6;

const today = DateTime.now().setZone(zone);

export const year = today < DateTime.fromObject({ year: today.year, month: 6, day: 30 }, { zone })
  ? today.year
  : today.year + 1;

const start = DateTime.fromObject({ year, month: 8, day: 1, hour: 15 }, { zone });

export const dates = {
  registration_start: DateTime.fromISO('2020-01-01T00:00:00.000-08:00', { zone }),
  registration_end: start.minus({ days: 1 }),
  start,
  end: start.plus({ days: lengthInDays }),
};

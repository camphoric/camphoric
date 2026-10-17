/**
 * Date helpers built on Luxon (SPEC §2, §10, DR-5). Be deliberate about UTC vs.
 * local boundaries to avoid off-by-one day errors — parse date-only values in a
 * fixed zone rather than relying on the ambient local zone.
 *
 * Form date values are `YYYY-MM-DD`; datetimes are ISO with offset. Pricing
 * logic receives dates as `{ year, month, day }` objects.
 */

import { DateTime } from 'luxon';

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

/** Parse a `YYYY-MM-DD` string into `{ year, month, day }` for pricing logic. */
export function dateStringToParts(value: string): DateParts {
  const dt = DateTime.fromISO(value, { zone: 'utc' });
  return { year: dt.year, month: dt.month, day: dt.day };
}

/**
 * The list of `YYYY-MM-DD` days spanning an event, inclusive of start and end
 * (none while either isn't set).
 */
export function eventDays(start: string | null, end: string | null): string[] {
  if (!start || !end) return [];
  const startDt = DateTime.fromISO(start, { zone: 'utc' }).startOf('day');
  const endDt = DateTime.fromISO(end, { zone: 'utc' }).startOf('day');
  if (!startDt.isValid || !endDt.isValid || endDt < startDt) return [];

  const days: string[] = [];
  for (let cursor = startDt; cursor <= endDt; cursor = cursor.plus({ days: 1 })) {
    const iso = cursor.toISODate();
    if (iso) days.push(iso);
  }
  return days;
}

/**
 * An ISO instant as a `DateTimePicker` value (`YYYY-MM-DD HH:mm:ss`): the clock
 * time in `zone` (an IANA name), or in the browser's zone without one.
 */
export function isoToLocalDateTime(iso: string, zone?: string): string {
  return DateTime.fromISO(iso, { zone }).toFormat('yyyy-MM-dd HH:mm:ss');
}

/**
 * A `DateTimePicker` value (`YYYY-MM-DD HH:mm[:ss]`), a clock time in `zone` (or
 * the browser's zone), as an ISO instant in UTC (`…Z`).
 */
export function localDateTimeToIso(value: string, zone?: string): string | null {
  return DateTime.fromSQL(value, { zone }).toUTC().toISO();
}

/**
 * The instant with the same clock time in `toZone` as `iso` has in `fromZone`:
 * 2 PM in Los Angeles becomes 2 PM in New York.
 */
export function keepClockTimeInZone(iso: string, fromZone: string, toZone: string): string | null {
  return DateTime.fromISO(iso, { zone: fromZone })
    .setZone(toZone, { keepLocalTime: true })
    .toUTC()
    .toISO();
}

/** A time zone's everyday name, e.g. "Pacific Time" for `America/Los_Angeles`. */
export function timeZoneName(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'longGeneric',
    }).formatToParts(new Date());
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? zone;
  } catch {
    // Not a zone this browser knows.
    return zone;
  }
}

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

/** The list of `YYYY-MM-DD` days spanning an event, inclusive of start and end. */
export function eventDays(start: string, end: string): string[] {
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

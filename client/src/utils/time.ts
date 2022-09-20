import moment from 'moment';
import debug from 'utils/debug';

/**
 * time utils
 *
 * All functions for dealing with time conversions, formatting, and timezone
 * info.
 */

export function formatDateForForm(...args: Parameters<typeof moment>) {
  const offset = new Date().getTimezoneOffset();

  return moment.utc(...args).utcOffset(offset).format('YYYY-MM-DD');
}

export const formatDateValue = formatDateForForm;

export function formatDateTimeForForm(...args: Parameters<typeof moment>) {
  const offset = new Date().getTimezoneOffset();

  return moment.utc(...args).utcOffset(offset).format();
}

export function formatDateTimeForViewing(...args: Parameters<typeof moment>) {
  const offset = new Date().getTimezoneOffset();

  return moment.utc(...args).utcOffset(offset)
    .format('MM/DD/YYYY');
}

// Note: this returns values for the browser's set timezone
export function getISOTimeZoneString() {
  const UTCOffsetMin = new Date().getTimezoneOffset();
  const sign = UTCOffsetMin < 0 ? '-' : '+';
  const hours = Math.floor(UTCOffsetMin / 60).toString().padStart(2, '0');
  const min = (UTCOffsetMin % 60).toString().padStart(2, '0');

  return `${sign}${hours}:${min}`;
}

// The input is is assumed to be in some logical date format.
export function formatDateTimeForApi(...args: Parameters<typeof moment>) {
  const offset = new Date().getTimezoneOffset();

  return moment.utc(...args).utcOffset(offset).format();
}

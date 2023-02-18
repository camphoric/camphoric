import moment from 'moment';

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

// https://momentjs.com/docs/#/displaying/format/
export function formatDateTimeForViewing(format: string = 'MM/DD/YYYY') {
  return (...args: Parameters<typeof moment>) => {
    const offset = new Date().getTimezoneOffset();

    return moment.utc(...args).utcOffset(offset).local()
      .format(format);
  };
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

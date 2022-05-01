/**
 * time utils
 *
 * All functions for dealing with time conversions, formatting, and timezone
 * info.
 */
export function formatDateTimeForForm(dateStr: string | null | undefined) {
  if (!dateStr) return undefined;

  const date = new Date(dateStr);

  if (!date) return undefined;

  // Note: this gets values in the browser's set timezone
  const year = date.getFullYear();
  const month = (1 + date.getMonth()).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  if ([year, month, day, hours, minutes].includes(NaN)) {
    return undefined;
  }

  return `${[year, month, day].join('-')}T${[hours, minutes].join(':')}`;
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
export function formatDateTimeForApi(dateStr: string | null) {
  const date = formatDateTimeForForm(dateStr);

  // fail if it could not convert to date object
  if (!date) return undefined;

  const formattedDate = `${date}${getISOTimeZoneString()}`;

  return formattedDate;
}

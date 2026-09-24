import { DateTime } from 'luxon';

export const lengthInDays = 5;

const today = DateTime.now();
export const year = today.year;

const startDate = DateTime.fromISO(`${year}-12-30T14:00:00.000-07:00`);
const regEndDate = DateTime.fromISO(`${year}-12-13T14:00:00.000-07:00`);

const dateHash = {
  registration_start: today,
  registration_end: regEndDate,
  start: startDate,
  end: startDate.plus({ day: lengthInDays }),
};

export const earlybirdCutoff = DateTime.fromISO(`${year}-11-15T23:59:00.000-07:00`);

export const yearDisplay = `${
  startDate.year
}-${
  (startDate.year + 1).toString().substring(2)
}`;
export const dates = dateHash;


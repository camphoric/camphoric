import { DateTime } from 'luxon';

export const lengthInDays = 9;

const today = DateTime.now().setZone("America/Los_Angeles");

export let year = today.year;

// if it is August or later, it's next years camp
// January gives 1 for getMonth
if (today.month > 7) {
  year = year + 1;
}

// find last Thursday in July as startDate
const getStartDate = (d) => {
  // Mon - Sun: 1 - 7
  if (d.weekday === 4) return d;

  return getStartDate(d.minus({ days: 1 }))
}

const startDate = getStartDate(DateTime.fromISO(`${year}-08-01T14:00:00.000-07:00`));

const getRegEnd = (d) => {
  // Mon - Sun: 1 - 7
  // reg ends on the Monday before camp starts
  if (d.weekday === 1) return d;

  return getRegEnd(d.minus({ days: 1 }))
}

const regEnd = getRegEnd(startDate.minus({ days: 1 }));

const eventEnd = startDate.plus({ days: lengthInDays });

const dateHash = {
  registration_start: today,
  registration_end: regEnd,
  start: startDate,
  end: eventEnd,
};

export const dates = dateHash;

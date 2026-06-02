import { DateTime } from 'luxon';

export const lengthInDays = 3;

const today = DateTime.now().setZone("America/Los_Angeles");

export let year = today.year;

// if it is October or later, we're testing next years camp
// January gives 0 for getMonth
if (today.month > 9) {
  year = year + 1;
}

// find second Friday in October as startDate
const getStartDate = () => {
  // Mon - Sun: 1 - 7

  let d = DateTime.fromISO(`${year}-10-01T14:00:00.000-07:00`).setZone("America/Los_Angeles");

  console.log('weekday', d.weekday);
  if (d.weekday === 5) {
    d = d.plus({ days: 7 });
  } else {
    do { d = d.plus({ days: 1 }) } while (d.weekday !== 5);
    d = d.plus({ days: 7 });
  }

  return d.plus({ days: 7 });
}

const startDate = getStartDate();
const regEnd = startDate.minus({ days: 1 });

const dateHash = {
  registration_start: today,
  registration_end: regEnd,
  start: startDate,
  end: startDate.plus({ days: 3 }).set({ hour: 10 }),
};

export const dates = dateHash;

// test
// Object.entries(dates).map(([k, d]) => {
//   const dd = d.toFormat("EEEE MMMM d 'at' t");
// 
//   console.log(`${k}: ${dd}`);
// });

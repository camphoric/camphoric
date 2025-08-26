export const lengthInDays = 3;

const today = new Date();

export let year = today.getFullYear();

// if it is October or later, we're testing next years camp
// January gives 0 for getMonth
if (today.getMonth() > 9) {
  year = year + 1;
}

const startDate = new Date(
  new Date(`${year}-10-10T15:00:00.000-07:00`).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles'
  })
);

const dateHash = {
  registration_start: new Date(),
  registration_end: new Date(startDate),
  start: startDate,
  end: new Date(startDate),
};

dateHash.registration_end.setUTCHours(startDate.getUTCHours() - 24);
dateHash.end.setUTCHours(startDate.getUTCHours() + (lengthInDays * 24));
dateHash.end.setHours(10);

export const dates = dateHash;

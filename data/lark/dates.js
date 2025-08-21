export const lengthInDays = 9;

const today = new Date();

export let year = today.getFullYear();

// if it is August or later, it's next years camp
// January gives 0 for getMonth
if (today.getMonth() > 6) {
  year = year + 1;
}

// find last Thursday in July as startDate
const getStartDate = (d) => {
  // Sunday - Saturday : 0 - 6
  const dayOfWeek = d.getDay();

  if (dayOfWeek === 4) return d;

  d.setDate(d.getDate() - 1);

  return getStartDate(d)
}
const startDate = getStartDate(new Date(year, 7, 0));

const getRegEnd = (d) => {
  // Sunday - Saturday : 0 - 6
  const dayOfWeek = d.getDay();

  if (dayOfWeek === 1) return d;

  d.setDate(d.getDate() - 1);

  return getRegEnd(d)
}
const regEnd = getRegEnd(new Date(startDate));

const eventEnd = new Date(startDate);
eventEnd.setUTCHours(startDate.getUTCHours() + (lengthInDays * 24));

const dateHash = {
  registration_start: today,
  registration_end: regEnd,
  start: startDate,
  end: eventEnd,
};

export const dates = dateHash;

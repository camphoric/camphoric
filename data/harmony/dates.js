export const lengthInDays = 5;
const startDate = new Date('2024-12-27T07:00:00.000-07:00');

const dateHash = {
  registration_start: new Date(),
  registration_end: new Date(startDate),
  start: startDate,
  end: new Date(startDate),
};

dateHash.registration_end.setUTCMonth(startDate.getUTCMonth() - 1);
dateHash.end.setUTCHours(startDate.getUTCHours() + (lengthInDays * 24));

export const year = dateHash.start.getFullYear();
export const yearDisplay = `${
  dateHash.start.getFullYear()
}-${
  (dateHash.start.getFullYear() + 1).toString().substring(2)
}`;
export const dates = dateHash;

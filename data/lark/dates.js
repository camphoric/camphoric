export const lengthInDays = 9;
const startDate = new Date('2023-07-27T10:00:00');
// startDate.setFullYear(startDate.getFullYear() + 1);
// startDate.setUTCHours(startDate.getUTCHours() + (30 * 24));

const dateHash = {
  registration_start: new Date(),
  registration_end: new Date(startDate),
  start: startDate,
  end: new Date(startDate),
};

dateHash.registration_end.setUTCMonth(startDate.getUTCMonth() - 1);
dateHash.end.setUTCHours(startDate.getUTCHours() + (lengthInDays * 24));

export const year = dateHash.start.getFullYear();
export const dates = dateHash;

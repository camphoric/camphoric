export const lengthInDays = 3;
const startDate = new Date('2023-10-06T14:00:00.000-07:00');

const dateHash = {
  registration_start: new Date(),
  registration_end: new Date(startDate),
  start: startDate,
  end: new Date(startDate),
};

dateHash.registration_end.setUTCHours(startDate.getUTCHours() - 24);
dateHash.end.setUTCHours(startDate.getUTCHours() + (lengthInDays * 24));

export const year = dateHash.start.getFullYear();
export const dates = dateHash;

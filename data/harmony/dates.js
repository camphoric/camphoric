export const lengthInDays = 5;
const startDate = new Date(Date.parse('27 Dec 2024 12:00:00 PST'));

const dateHash = {
  registration_start: new Date(),
  registration_end: new Date(Date.parse('15 Dec 2024 12:00:00 PST')),
  start: startDate,
  end: new Date(startDate),
};

dateHash.end.setUTCHours(startDate.getUTCHours() + (lengthInDays * 24));

export const year = dateHash.start.getFullYear();
export const yearDisplay = `${
  dateHash.start.getFullYear()
}-${
  (dateHash.start.getFullYear() + 1).toString().substring(2)
}`;
export const dates = dateHash;

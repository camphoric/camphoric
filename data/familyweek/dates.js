export const lengthInDays = 5;

const dateHash = {
  registration_start: new Date(),
  registration_end: new Date('2023-06-15'),
  start: new Date('2023-06-25'),
  end: new Date('2023-07-01'),
};

export const year = dateHash.start.getFullYear();
export const dates = dateHash;

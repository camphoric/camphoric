/** Registrations as two registrars left them, for the edit-conflict stories and tests. */

export const BASE = {
  registrant_email: 'pat@example.com',
  registration_type: null as number | null,
  attributes: { first_name: 'Pat', diet: 'None', days: ['Mon', 'Tue'] },
};

/** I fixed the diet; they changed the email. */
export const MINE_APART = { ...BASE, attributes: { ...BASE.attributes, diet: 'Vegan' } };
export const THEIRS_APART = { ...BASE, registrant_email: 'pat@example.org' };

/** We both changed the first name. */
export const MINE_CLASH = {
  ...BASE,
  attributes: { ...BASE.attributes, first_name: 'Pattie', diet: 'Vegan' },
};
export const THEIRS_CLASH = {
  ...BASE,
  registration_type: 2,
  attributes: { ...BASE.attributes, first_name: 'Patricia' },
};

export const LABELS = { registrant_email: 'Registrant email', first_name: 'First name' };

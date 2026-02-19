/**
 * Deposit schema
 *
 * A json schema that defines deposit choices.  The choice is a json string
 * with the following properties:
 *
 * {
 *   name: string, // the name of the option
 *   logic: string (jsonLogic) // json logic, for which the totals are passed,
 *          and should result in the new total if this deposit choice is made
 * }
 */

const full = {
  name: 'Full Payment',
  logic: { var: ['total'] }
};
const deposit = {
  name: '50% Deposit',
  logic: {
    '-': [
      { var: ['total'] },
      { '*': [{ var: ['tuition', 0]}, 0.5] },
      { '*': [{ var: ['meals', 0]}, 0.5] },
    ],
  },
};

const options = [
  full,
  deposit,
];


export default {
  'title': 'Full Payment or Deposit Only',
  'type': 'string',
  'description': `
You may either: make a nonrefundable 50% deposit to hold your place, or pay in
full. If you choose the deposit option, the balance will be due by June 20.

The 50% deposit only applies to tuition and meals. All other charges must be
paid in full up front.
`,
  enum: options.map(o => JSON.stringify(o)),
  enumNames: options.map(o => o.name),
  default: JSON.stringify(options[0]), 
};

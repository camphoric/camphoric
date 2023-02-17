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
      {
        '*': [
          { var: ['tuition'] },
          0.5,
        ],
      },
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
  'description': `You may pay either your full registration fee or a 50% deposit to reserve your place at camp.

Your 50% deposit is non-refundable.  If you pay the full amount, only 50% is refundable.  Please consider purchasing trip insurance if you know something could prevent your attendance.`,
  enum: options.map(o => JSON.stringify(o)),
  enumNames: options.map(o => o.name),
  default: JSON.stringify(options[0]), 
};

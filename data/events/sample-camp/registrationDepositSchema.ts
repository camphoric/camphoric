import { balanceDueDate } from './templateVars.ts';

/**
 * The payment options a registrant chooses between. Each choice is a JSON
 * string of { name, logic }, where the JSON Logic works out the amount to pay
 * now from the pricing results. A sample registration names an option by its
 * name (paymentData.paymentOption).
 */
export const fullPayment = {
  name: 'Pay in full',
  logic: { var: ['total'] },
};

export const deposit = {
  name: 'Pay a $50 deposit per camper',
  logic: { '*': [
    50,
    { reduce: [{ var: 'campers' }, { '+': [1, { var: 'accumulator' }] }, 0] },
  ] },
};

const options = [fullPayment, deposit];

export default {
  title: 'Pay in full, or a deposit now',
  type: 'string',
  description: `If you pay a deposit, the rest is due by ${balanceDueDate}.`,
  oneOf: options.map(o => ({ const: JSON.stringify(o), title: o.name })),
  default: JSON.stringify(fullPayment),
};

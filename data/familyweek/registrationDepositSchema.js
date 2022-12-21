const options = [
  {
    name: 'Pay my full registration',
    logic: { var: ['total'] }
  },
  {
    name: 'Pay a deposit of $50 per camper',
    logic: { '*': [
      50,
      { reduce: [
        { var: 'campers' },
        { '+': [1, { var: 'accumulator' }]},
        0
      ]},
    ]},
  },
];

export default {
  title: 'Full Payment or Deposit Only',
  type: 'string',
  description: 'Please choose a payment option. If you choose to pay a deposit, the full balance will be due by June 1st.',
  enum: options.map(o => JSON.stringify(o)),
  enumNames: options.map(o => o.name),
  default: JSON.stringify(options[0]), 
};

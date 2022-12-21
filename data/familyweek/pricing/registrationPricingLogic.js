export default [
  /*
  {
    var: 'pay_all',
    exp: {'==': [{var: 'registration.payment_option'}, 'pay_all']},
  },
  {
    var: 'pay_deposit',
    exp: {'==': [{var: 'registration.payment_option'}, 'pay_deposit']},
  },
  */
  {
    var: 'total',
    exp: {var: 'registration.donation'},
  },
];

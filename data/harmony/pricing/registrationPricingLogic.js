export default [
  {
    var: 'campership_donation',
    label: 'Campership Donation',
    exp: {'var': ['registration.campership_donation', 0]}
  },
  {
    var: 'total',
    label: 'Grand Total',
    exp: {
      '+': [
        {var: 'campership_donation'},
      ]
    },
  },
];

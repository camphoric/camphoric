export default [
  {
    var: 'campership_donation',
    exp: {'var': ['registration.campership_donation', 0]}
  },
  {
    var: 'total',
    exp: {
      '+': [
        {var: 'campership_donation'},
      ]
    },
  },
];

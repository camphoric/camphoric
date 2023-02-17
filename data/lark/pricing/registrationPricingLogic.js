const regType = {var: ['registration.registration_type']};

export default [
  {
    var: 'parking',
    exp: {
      '*': [
        {'reduce': [
          {'var': 'registration.parking_passes'},
          {'+':[
            {'var': 'accumulator'},
            1
          ]}, 0
        ]},
        { if: [
          { '!': regType },
          {'var': 'pricing.parking_pass'},
          0
        ] },
      ]
    }
  },
  {
    var: 'donation',
    exp: {'var': ['registration.lta_donation', 0]}
  },
  {
    var: 'total',
    exp: {
      '+': [
        {var: 'parking'},
        {var: 'donation'},
      ]
    },
  },
];

const regType = {var: ['registration.registration_type']};

export default [
  {
    var: 'parking',
    exp: {
      '*': [
        {
          // count parking passes,
          // -1 if special reg type, 
          // make sure we don't go negative
          max: [
            0,
            {'reduce': [
              {'var': 'registration.parking_passes'},
              {'+':[
                {'var': 'accumulator'},
                1
              ]},
              { if: [ { '!': regType }, 0, -1 ] },
            ]},
          ],
        },
        {'var': 'pricing.parking_pass'}
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

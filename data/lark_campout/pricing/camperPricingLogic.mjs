export const ageLookup = {
  65: "65 years old or older",
  64: "50-64 years old",
  49: "26-49 years old",
  25: "18-25 years old",
  17: "12-17 years old",
  11: "5-11 years old",
  4:  "0-4 years old",
};

const defaultCamperAge = ageLookup[65];
const camperAge = {var: ['camper.age', defaultCamperAge]};

const regularTuitionPriceMatrix = [
  [ 65, 'pricing.adult', 'pricing.off_site' ],
  [ 64, 'pricing.adult', 'pricing.off_site' ],
  [ 49, 'pricing.adult', 'pricing.off_site' ],
  [ 25, 'pricing.adult', 'pricing.off_site' ],
  [ 17, 'pricing.youth', 'pricing.off_site' ],
  [ 11, 'pricing.youth', 'pricing.off_site' ],
  [ 4,  'pricing.youth', 'pricing.off_site' ],
];

const tuition = (offsiteId) => ({
  '*': [
    {
      'if': regularTuitionPriceMatrix.reduce((acc, [ age, full, off_site ]) => {
        return [
          ...acc,
          { '===': [ageLookup[age], camperAge] }, {
            'if': [
              {'===': [offsiteId, {var: 'camper.lodging.lodging_1'}]},
              {var: off_site }, {var: full}
            ]
          }
        ]
      }, []).concat([0]),
    },
  ]
}); // END regularPrice tuition

export default (offsiteId) => [
  {
    var: 'tuition',
    exp: tuition(offsiteId),
  },
  {
    var: 'total',
    exp: {
      '+': [
        {var: 'tuition'},
      ]
    }
  }
];


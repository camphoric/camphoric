import pricingValues from './pricing.js';

export const ageLookup = {
  65: '65 years old or older',
  64: '50-64 years old',
  49: '26-49 years old',
  25: '18-25 years old',
  17: '12-17 years old',
  11: '5-11 years old',
  4:  '0-4 years old',
};

export const agePricingTypes = {
  adult: ['65 years old or older','50-64 years old','26-49 years old'],
  yadult: ['18-25 years old'],
  child: ['12-17 years old', '5-11 years old'],
  baby:  ['0-4 years old'],
};

const defaultCamperAge = ageLookup[65];
const camperAge = {var: ['camper.age', defaultCamperAge]};

const getRates = (lodgingIds) => ({
  'if': Object.keys(pricingValues).reduce((acc, key) => {
    const [ageKey, lodgingKey] = key.split('_');

    let lid;
    try  {
      lid = lodgingIds[lodgingKey].id;
    } catch (e) {
      console.error(lodgingKey, e);
      throw e;
    }

    return [
      ...acc,
      {
        'and': [
          // age
          { 'or': agePricingTypes[ageKey].map(a => (
            { '===': [a, camperAge] }
          )) },

          // lodging
          { '===': [lid, {var: 'camper.lodging.lodging_requested.id'}] },
        ]
      }, {var: `pricing.${[ageKey, lodgingKey].join('_')}`},
    ];
  }, []).concat([0]),
});

export default (lodgingIds) => [
  {
    var: 'tuition',
    exp: getRates(lodgingIds),
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


import pricingValues from './pricing.js';

export const ageLookup = {
  adult: ['31+ years old'],
  yadult: ['18-30 years old', '13-17 years old'],
  child: ['3-12 years old'],
  baby: ['0-2 years old'],
};

const cutoff = Date.parse('01 Nov 2023 00:00:00 PST');
const defaultCamperAge = ageLookup.adult;
const camperAge = {var: ['camper.age', defaultCamperAge]};

const dayCount = ({
  'reduce': [
    {var: 'camper.attendance'},
    {'+':[1, {var:'accumulator'}]},
    0
  ]
});

const getRates = (lodgingIds, early) => ({
  'if': Object.keys(pricingValues).reduce((acc, key) => {
    const [agek, lodgingk, , fullcampk] = key.split('_');

    return [
      ...acc,
      {
        'and': [
          // age
          { 'or': ageLookup[agek].map(a => (
            { '===': [a, camperAge] }
          )) },

          // lodging
          { '===': [lodgingIds[lodgingk].id, {var: 'camper.lodging.lodging_requested.id'}] },

          // full camp or partial
          {
            [ fullcampk === 'full' ? '===' : '!=' ]: [
              5, dayCount
            ]
          },
        ]
      }, {var: `pricing.${[agek, lodgingk, early, fullcampk].join('_')}`},
    ];
  }, []).concat([0]),
});

const calculateCampership = {
  min: [
    { var: 'camper.campership_request' },
    { '/': [ { '*': [dayCount, { var: 'early_rate' } ] } , 2] }
  ]
};

const tuition = {
  'if': [
    { '<': [{var: 'date.epoch'}, cutoff] },
    { '*': [{ var: 'early_rate' }, dayCount] },
    { '*': [{ var: 'regular_rate' }, dayCount] },
  ]
};

export default (lodgingIds) => [
  {
    var: 'early_rate',
    exp: getRates(lodgingIds, 'early'),
  },
  {
    var: 'regular_rate',
    exp: getRates(lodgingIds, 'regular'),
  },
  {
    var: 'campership_calculated',
    exp: calculateCampership,
  },
  {
    var: 'tuition',
    exp: tuition,
  },
  {
    var: 'total',
    exp: {
      '-': [
        {var: 'tuition'},
        {var: 'campership_calculated'},
      ]
    }
  }
];


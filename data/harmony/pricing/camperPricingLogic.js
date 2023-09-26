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
          { 'in': [lodgingIds[lodgingk].id, {var: 'camper.lodging.lodging_requested.choices'}] },

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

const calculateCampershipRate = ({
  'if': [
    'adult_full',
    'yadult_full',
    'child_full',
    'baby_full',
    'adult_perday',
    'yadult_perday',
    'child_perday',
    'baby_perday',
  ].reduce((acc, key) => {
    const [agek, fullcampk] = key.split('_');

    return [
      ...acc,
      {
        'and': [
          // age
          { 'or': ageLookup[agek].map(a => (
            { '===': [a, camperAge] }
          )) },

          // full camp or partial
          {
            [ fullcampk === 'full' ? '===' : '!=' ]: [
              5, dayCount
            ]
          },
        ]
      }, {var: `pricing.${[agek, 'econ', 'early', fullcampk].join('_')}`},
    ];
  }, []).concat([2]),
});

const calculateCampership = {
  min: [
    {
      'or': [
        { var: 'camper.campership_request' },
        0,
      ],
    },
    { '/': [ { '*': [dayCount, calculateCampershipRate] }, 2] },
    { '/': [ { var: 'tuition' }, 2] },
    300,
  ],
};

const calculateLinens = {
  '*': [
    {
      'if': [
        {'===' : [{ var: 'camper.linens' }, 'Yes']},
        1, 0,
      ],
    },
    25
  ]
};


const rate = (lodgingIds) => ({
  'if': [
    { '<': [{var: 'registration.created_at.epoch'}, cutoff] },
    getRates(lodgingIds, 'early'),
    getRates(lodgingIds, 'regular'),
  ]
});

export default (lodgingIds) => [
  {
    var: 'rate',
    exp: rate(lodgingIds),
  },
  {
    var: 'tuition',
    exp: { '*': [{ var: 'rate' }, dayCount] },
  },
  {
    var: 'campership',
    exp: calculateCampership,
  },
  {
    var: 'linens',
    exp: calculateLinens,
  },
  {
    var: 'total',
    exp: {
      '+': [
        {var: 'tuition'},
        { '*': [ {var: 'campership'}, -1 ] },
        {var: 'linens'},
      ]
    }
  }
];


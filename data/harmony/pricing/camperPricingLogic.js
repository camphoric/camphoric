import pricingValues from './pricing.js';

export const ageLookup = {
  adult: ['31-69 years old', '70+ years old'],
  yadult: ['18-30 years old', '13-17 years old'],
  child: ['3-12 years old'],
  baby: ['0-2 years old'],
};

const cutoff = Math.floor(
  Date.parse('15 Nov 2024 00:00:00 PST') / 1000
);
const defaultCamperAge = ageLookup.adult;
const camperAge = {var: ['camper.age', defaultCamperAge]};

const dayCount = ({
  'reduce': [
    {var: 'camper.attendance'},
    {'+':[1, {var:'accumulator'}]},
    0
  ]
});

const pricingToExclude = [
  'linen_rate',
];

const pricingKeys = Object.keys(pricingValues).filter(
  k => !pricingToExclude.includes(k)
);

const getRates = (lodgingIds, early) => ({
  'if': pricingKeys.reduce((acc, key) => {
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
        ]
      }, {var: `pricing.${[agek, lodgingk, early, fullcampk].join('_')}`},
    ];
  }, []).concat([0]),
});

// $60 per day or $300, whichever is less
const calculateCampership = {
  min: [
    {
      'or': [
        { var: 'camper.campership_request' },
        0,
      ],
    },
    { '*': [dayCount, 60] },
  ],
};

const calculateLinens = (lodgingIds) => ({
  'if': [
    // list of lodging that gets $0 rate for linens
    'lodge',
    'apt',
  ].reduce(
    (acc, lodgingk) => {
      return [
        ...acc,
        { 'in': [lodgingIds[lodgingk].id, {var: 'camper.lodging.lodging_requested.choices'}] },
        0,
      ];
    }, []
  ).concat([
    {'===' : [{ var: 'camper.linens' }, 'Yes']},
    { var: 'pricing.linen_rate' },
    0
  ]),
});

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
    exp: calculateLinens(lodgingIds),
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


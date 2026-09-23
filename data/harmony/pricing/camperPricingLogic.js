import pricingValues from './pricing.js';
import { earlybirdCutoff } from '../dates.js';

export const ageLookup = {
  adult: ['31-79 years old', '80+ years old'],
  yadult: ['18-30 years old', '13-17 years old'],
  child: ['3-12 years old'],
  baby: ['0-2 years old'],
};

const cutoff = Math.floor(earlybirdCutoff.toSeconds());

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
  'private_room_rate',
  'max_campership_perday',
];

const pricingKeys = Object.keys(pricingValues).filter(
  k => !pricingToExclude.includes(k)
);

const getRates = (lodgingIds, early) => ({
  'if': pricingKeys.reduce((acc, key) => {
    const [agek, lodgingk, , fullcampk] = key.split('_');
    let lodgingId;

    try {
      lodgingId = lodgingIds[lodgingk].id;
    } catch (e) {
      console.error(`tried looking up lodging ${lodgingk}, failed`, key);
      throw e;
    }

    return [
      ...acc,
      {
        'and': [
          // age
          { 'or': ageLookup[agek].map(a => (
            { '===': [a, camperAge] }
          )) },

          // lodging
          { 'in': [lodgingId, {var: 'camper.lodging.lodging_requested.choices'}] },
        ]
      }, {var: `pricing.${[agek, lodgingk, early, fullcampk].join('_')}`},
    ];
  }, []).concat([0]),
});

const calculateCampership = {
  min: [
    {
      'or': [
        { var: 'camper.campership_request' },
        0,
      ],
    },
    { '*': [dayCount, { var: 'pricing.max_campership_perday' }] },
  ],
};

const calculatePrivateRoom = (lodgingIds) => ({
  'if': [
    // list of lodging that gets $0 rate for private rooms - this is
    // essentially ones that can't get a private room
    'lodge',
  ].reduce(
    (acc, lodgingk) => {
      return [
        ...acc,
        { 'in': [lodgingIds[lodgingk].id, {var: 'camper.lodging.lodging_requested.choices'}] },
        0,
      ];
    }, []
  ).concat([
    {'===' : [{ var: 'camper.lodging_private' }, true]},
    { '*': [{ var: 'pricing.private_room_rate' }, dayCount] },
    0
  ]),
});


const calculateLinens = (lodgingIds) => ({
  'if': [
    // list of lodging that gets $0 rate for linens
    'lodge',
    // 'apt',
  ].reduce(
    (acc, lodgingk) => {
      return [
        ...acc,
        { 'in': [lodgingIds[lodgingk].id, {var: 'camper.lodging.lodging_requested.choices'}] },
        0,
      ];
    }, []
  ).concat([
    {'===' : [{ var: 'camper.linens' }, true]},
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
    label: 'Lodging Rate Per Day',
    exp: rate(lodgingIds),
  },
  {
    var: 'lodging_total',
    label: 'Lodging Total',
    exp: { '*': [{ var: 'rate' }, dayCount] },
  },
  {
    var: 'campership',
    label: 'Requested Campership',
    exp: calculateCampership,
  },
  {
    var: 'linen_fee',
    label: 'Linen Fee',
    exp: calculateLinens(lodgingIds),
  },
  {
    var: 'private_room_fee',
    label: 'Private Room Fee',
    exp: calculatePrivateRoom(lodgingIds),
  },
  {
    var: 'total',
    label: 'Total',
    exp: {
      '+': [
        {var: 'lodging_total'},
        { '*': [ {var: 'campership'}, -1 ] },
        {var: 'linen_fee'},
        {var: 'private_room_fee'},
      ]
    }
  }
];


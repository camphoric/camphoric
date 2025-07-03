import pricing from './pricing.js';
import { regTypes } from '../registrationTypes.js';
import { difference } from 'lodash';

export const ageLookup = {
  65: '65 years old or older',
  64: '50-64 years old',
  49: '26-49 years old',
  25: '18-25 years old',
  17: '12-17 years old',
  11: '5-11 years old',
  4:  '0-4 years old',
};

export const mealsLookup = {
  'F': 'All Meals',
  'D': 'Just Dinners',
  'A': 'All Meals - 1st half',
  'B': 'All Meals - 2nd half',
};

const defaultCamperAge = ageLookup[65];
const camperAge = {var: ['camper.age', defaultCamperAge]};
const regTypeNames = regTypes.map(t => t.name);

const regularTuitionPriceMatrix = [
  [ 65, 'pricing.full_adult',   'pricing.half_adult' ],
  [ 64, 'pricing.full_adult',   'pricing.half_adult' ],
  [ 49, 'pricing.full_adult',   'pricing.half_adult' ],
  [ 25, 'pricing.full_adult',   'pricing.half_adult' ],
  [ 17, 'pricing.full_youth',    'pricing.half_youth' ],
  [ 11, 'pricing.full_youth',    'pricing.half_youth' ],
  [ 4,  'pricing.full_kid', 'pricing.half_kid' ],
];

const regularMealsPriceMatrix = [
  [ 65, 'pricing.meals_adult_full', 'pricing.meals_adult_dinners', 'pricing.meals_adult_half' ],
  [ 64, 'pricing.meals_adult_full', 'pricing.meals_adult_dinners', 'pricing.meals_adult_half' ],
  [ 49, 'pricing.meals_adult_full', 'pricing.meals_adult_dinners', 'pricing.meals_adult_half' ],
  [ 25, 'pricing.meals_adult_full',  'pricing.meals_adult_dinners',  'pricing.meals_adult_half' ],
  [ 17, 'pricing.meals_adult_full',  'pricing.meals_adult_dinners',  'pricing.meals_adult_half' ],
  [ 11, 'pricing.meals_youth_full',  'pricing.meals_youth_dinners',  'pricing.meals_youth_half' ],
  [ 4,  'pricing.meals_youth_full',  'pricing.meals_youth_dinners',  'pricing.meals_youth_half' ],
];

const regType = {var: ['registration.registration_type']};
const regTypeEquals = (type, price) => {
  if (!regTypeNames.find(type)) {
    throw new Error(`regTypeEquals: reg type ${type} does not exist`);
  }

  return [
    {
      and: [
        { '===': [type, regType] },
        // Only apply special pricing to the first one
        { '===': [{var: ['camper.index']}, 0] },
      ],
    }, price,
  ];
};

const regTypeIn = (types, price) => {
  const badRegTypes = difference(types, regTypes);

  if (badRegTypes.length) {
    throw new Error(`regTypeIn: reg type(s) do not exist: ${badRegTypes.join(', ')}`);
  }

  return [
    { 'in': [regType, types] },
    price,
  ];
}

const regularPrice = {
  tuition: {
    '+': [{
      'if': [
        ...regTypeIn([
          'office-camp-1',
          'office-camp-2',
          'office-camp-3',
          'setup-teardown',
          'cleanup-camp-1',
          'cleanup-camp-2',
          'cleanup-camp-3',
          'misc-staff',
          'management',
          'security',
          'talent',
          'kitchen-full',
        ], 0),
        ...regTypeEquals('talent-guest',{var: 'pricing.talent_guest'}),
        ...regTypeEquals('kitchen-partial', {var: 'pricing.kitchen_partial'}),
        // Standard pricing
        ...regularTuitionPriceMatrix.reduce((acc, [ age, full, half ]) => {
          return [
            ...acc,
            { '===': [ageLookup[age], camperAge] },
            {
              'if': [
                {'===': ['Full camp', {var: 'camper.session'}]},
                {var: full }, {var: half}
              ]
            }
          ];
        }, []).concat([9999]),
        // END Standard pricing
      ],
    }]
  }, // END regularPrice tuition

  meals: {
    '+': [
      {
        'if': [
          ...regTypeIn([
            'kitchen-full',
            'kitchen-partial',
            'management',
            'security',
            'talent',
          ], 0),
          ...regularMealsPriceMatrix.reduce((acc, [ age, full, dinners, half ]) => {
            return [
              ...acc,
              { '===': [ageLookup[age], camperAge] }, {
                'if': [
                  { '===': ['None', {var: 'camper.meals.meal_plan'}] }, 0,
                  { '===': [mealsLookup['F'], {var: 'camper.meals.meal_plan'}] }, {var: full},
                  { '===': [mealsLookup['D'], {var: 'camper.meals.meal_plan'}] }, {var: dinners},
                  { '===': [mealsLookup['A'], {var: 'camper.meals.meal_plan'}] }, {var: half},
                  { '===': [mealsLookup['B'], {var: 'camper.meals.meal_plan'}] }, {var: half},
                  0
                ]
              }
            ];
          }, []).concat([0]),

        ]
      },
    ]
  }, // END regularPrice meals

  name_badge: {
    'if': [
      ...regTypeIn([
        'management',
        'security',
        'talent',
        'office-camp-1',
        'office-camp-2',
        'office-camp-3',
      ], 0),
      {var: ['camper.name_badge.purchase']},
      {var: ['pricing.name_badge']},
      0,
    ],
  }, // END regularPrice parking

  parking: {
    '*': [
      {'reduce': [
        {'var': 'camper.parking_passes'},
        {'+':[
          {'var': 'accumulator'},
          1
        ]}, 0
      ]},
      { if: [
        // reg types that get free parking
        ...regTypeIn([
          'office-camp-1',
          'office-camp-2',
          'office-camp-3',
          'kitchen-full',
          'kitchen-partial',
          'setup-teardown',
          'cleanup-camp-1',
          'cleanup-camp-2',
          'cleanup-camp-3',
          'talent',
          // 'talent-guest',
          'management',
          'misc-staff',
          // 'late-registrant',
          'security',
        ], 0),
        {'var': 'pricing.parking_pass'},
      ] },
    ]
  }, // END regularPrice parking
}; // END regularPrice

// uncomment for debug
// console.log(
//   JSON.stringify(regularPrice.tuition, null, 2)
// );

export default [
  {
    label: 'Tuition',
    var: 'tuition',
    exp: regularPrice.tuition,
  },
  {
    label: 'Meals',
    var: 'meals',
    exp: regularPrice.meals
  },
  {
    label: 'Parking',
    var: 'parking',
    exp: regularPrice.parking
  },
  {
    label: 'Name Badge',
    var: 'name_badge',
    exp: regularPrice.name_badge
  },
  {
    label: 'Custom Charges',
    var: 'custom_charges',
    exp: { 'reduce': [
      {'var':'camper.custom_charges'},
      {'+':[{'var':'current.amount'}, {'var':'accumulator'}]},
      0
    ]},
  },
  {
    label: 'Total',
    var: 'total',
    exp: {
      '+': [
				{var: 'tuition'},
        {var: 'meals'},
        {var: 'parking'},
        {var: 'name_badge'},
        {var: 'custom_charges'},
      ]
    }
  }
];


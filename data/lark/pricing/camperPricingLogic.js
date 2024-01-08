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
  [ 25, 'pricing.meals_adult_full',  'pricing.meals_adult_dinners',  'pricing.meals_adult_dinners' ],
  [ 17, 'pricing.meals_adult_full',  'pricing.meals_adult_dinners',  'pricing.meals_adult_dinners' ],
  [ 11, 'pricing.meals_youth_full',  'pricing.meals_youth_dinners',  'pricing.meals_youth_half' ],
  [ 4,  'pricing.meals_youth_full',  'pricing.meals_youth_dinners',  'pricing.meals_youth_half' ],
];

const regType = {var: ['registration.registration_type']};
const regTypeEquals = (type, price) => ([
  {
    and: [
      { '===': [type, regType] },
      // Only apply special pricing to the first one
      { '===': [{var: ['camper.index']}, 0] },
    ],
  }, price,
]);

const instructorTypeEquals = (type, price) => ([
  {
    and: [
      { '===': [type, regType] },
      // Only apply special pricing to the first one
      {
        or: [
          {
            '===': [{var: ['camper.index']}, 0],
          },
          {
            '===': [{var: ['camper.index']}, 1],
          },
        ],
      }
    ],
  }, price,
]);

const regularPrice = {
  tuition: {
    '+': [{
      'if': [
        ...regTypeEquals('crew-registration', 0),
        ...regTypeEquals('crew-setup', 0),
        ...regTypeEquals('crew-cleanup', 0),

        ...regTypeEquals('crew-kitchen-full', 0),
        ...regTypeEquals('crew-kitchen-partial', 398),
        ...regTypeEquals('crew-setup', 0),
        ...regTypeEquals('management', 0),
        // First or second registrant is free for instructor 
        ...instructorTypeEquals('talent', 0),
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
          ...regTypeEquals('crew-kitchen-full', 0),
          ...regTypeEquals('crew-kitchen-partial', 0),
          ...regTypeEquals('management', 0),
          // First registrant meal is free for instructor 
          ...regTypeEquals('talent', 0),
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
  } // END regularPrice meals
}; // END regularPrice

// uncomment for debug
// console.log(
//   JSON.stringify(regularPrice.tuition, null, 2)
// );

export default [
  {
    var: 'tuition',
    exp: regularPrice.tuition,
  },
  {
    var: 'meals',
    exp: regularPrice.meals
  },
  {
    var: 'total',
    exp: {
      '+': [
        {var: 'tuition'},
        {var: 'meals'},
      ]
    }
  }
];


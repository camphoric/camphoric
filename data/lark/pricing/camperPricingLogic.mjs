const defaultCamperAge = 65;
const camperAge = {var: ['camper.age', defaultCamperAge]};

const regularTuitionPriceMatrix = [
  [ 65, 'pricing.full_adult',   'pricing.half_adult' ],
  [ 64, 'pricing.full_adult',   'pricing.half_adult' ],
  [ 49, 'pricing.full_adult',   'pricing.half_adult' ],
  [ 25, 'pricing.full_adult',   'pricing.half_adult' ],
  [ 17, 'pricing.full_teen',    'pricing.half_teen' ],
  [ 11, 'pricing.full_teen',    'pricing.half_teen' ],
  [ 4,  'pricing.full_toddler', 'pricing.half_toddler' ],
];

const regularMealsPriceMatrix = [
  [ 65, 'pricing.meals_adult_full', 'pricing.meals_adult_dinners', 'pricing.meals_adult_half' ],
  [ 64, 'pricing.meals_adult_full', 'pricing.meals_adult_dinners', 'pricing.meals_adult_half' ],
  [ 49, 'pricing.meals_adult_full', 'pricing.meals_adult_dinners', 'pricing.meals_adult_half' ],
  [ 25, 'pricing.meals_adult_full',  'pricing.meals_adult_dinners',  'pricing.meals_adult_dinners' ],
  [ 17, 'pricing.meals_adult_full',  'pricing.meals_adult_dinners',  'pricing.meals_adult_dinners' ],
  [ 11, 'pricing.meals_teen_full',  'pricing.meals_teen_dinners',  'pricing.meals_teen_dinners' ],
  [ 4,  'pricing.meals_teen_full',  'pricing.meals_teen_dinners',  'pricing.meals_teen_dinners' ],
];

const regularPrice = {
  tuition: {
    '*': [
      {
        'if': regularTuitionPriceMatrix.reduce((acc, [ age, full, half ]) => {
          return [
            ...acc,
            { '==': [age, camperAge] }, { 
              'if': [
                {'===': ['F', {var: 'camper.session'}]}, 
                {var: full }, {var: half}
              ]
            }
          ]
        }, []).concat([0]),
      },
      {  'if': [
        { '===': ['deposit', {var: 'registration.payment.payment_full_or_deposit'}] },
        0.5,
        1
      ]}
    ]
  }, // END regularPrice tuition

  meals: {
    "+": [
      {
        'if': regularMealsPriceMatrix.reduce((acc, [ age, full, dinners, half ]) => {
          return [
            ...acc,
            { '==': [age, camperAge] }, { 
              'if': [
                { '===': ['', {var: 'camper.meals.meal_plan'}] }, 0,
                { '===': ['F', {var: 'camper.meals.meal_plan'}] }, {var: full},
                { '===': ['D', {var: 'camper.meals.meal_plan'}] }, {var: dinners},
                { '===': ['A', {var: 'camper.meals.meal_plan'}] }, {var: half},
                { '===': ['B', {var: 'camper.meals.meal_plan'}] }, {var: half},
                0
              ]
            }
          ]
        }, []).concat([0]),
      },
    ]
  } // END regularPrice meals
} // END regularPrice

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


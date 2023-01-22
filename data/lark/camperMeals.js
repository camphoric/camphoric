import { mealsLookup } from './pricing/camperPricingLogic.js';

const dependencies = {
  'meal_plan': {
    'oneOf': [
      {
        'properties': {
          'meal_plan': {
            'enum': ['']
          }
        }
      },
      {
        'properties': {
          'meal_plan': {
            'enum': [
              'All meals',
              'Just Dinners',
              'All Meals - 1st half',
              'All Meals - 2nd half'
            ]
          },
          'meal_type': {
            'type': 'string',
            'title': 'What types of meals do you want?',
            'enum': [
              'Non-Vegetarian',
              'Vegetarian',
              'Vegan'
            ],
          }
        }
      }
    ]
  }
};

const createMeals = (...options) => ({
  'type': 'object',
  'title': 'Meal Plans',
  'description': `Meal plans must be fully paid {meals_due_date}. We cannot accept partial payments. Food prices include sales tax.

NOTE: You may only cook if you’re camping in a vehicle with a built-in kitchen. No portable white gas or propane stoves are allowed in the park.

| Meal Plan Pricing | adult age 12+ | child ages 0-11 |
| --- | --- | --- |
| Full camp, full meals   | \${{pricing.meals_adult_full}} adults    | \${{pricing.meals_teen_full}} kids |
| Full camp, just dinners | \${{pricing.meals_adult_dinners}} adults | \${{pricing.meals_teen_dinners}} kids |
| Half camp, full meals   | \${{pricing.meals_adult_half}} adults    | \${{pricing.meals_teen_half}} kids |

Meal plans offer significant savings. You may buy individual meals at camp instead of buying a meal plan. (But it costs more!)`,
  'properties': {
    'meal_plan': {
      'type': 'string',
      'title': 'What meals will you purchase?',
      'enum': [
        'None',
        ...options.map(o => mealsLookup[o])
      ],
      'default': ''
    }
  },
  'dependencies': dependencies,
});

export default createMeals;

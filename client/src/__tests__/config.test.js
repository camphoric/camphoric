import fs from 'fs';
import jsonLogic from 'json-logic-js';
import { calculatePrice } from '../components/utils';
const config = fs.readFileSync('public/config.json');
  

describe('Config object', () => {
  it('is valid JSON', () => {
    expect(JSON.parse(config));
  });
  
  it('has the appropriate keys', () => {
    ['uiSchema', 'dataSchema', 'pricingLogic', 'pricing'].forEach((property) => {
      expect(JSON.parse(config)).toHaveProperty(property);
    });
  });
});

describe('Pricing Logic', () => {
  // A truth table is a little easier to work with here.
  // [Payment type, camp duration, meals, age, # parking passes]

	const conf = JSON.parse(config);
	
  const truthTable = [
    // Discount logic
    ['Check', 'full', 'F', '', , 0, conf.pricing.full_adult + conf.pricing.check_discount_full],
    ['Paypal', 'full', 'F', '', , 0, conf.pricing.full_adult],
    ['Credit Card', 'full', 'F', '', , 0, conf.pricing.full_adult],
  
		// Different ages across different camp types
    ['Paypal', 'full', 'F', '', 18, 0, conf.pricing.full_adult],
    ['Paypal', 'full', 'F', '', 11, 0, conf.pricing.full_teen],
    ['Paypal', 'full', 'F', '', 3, 0, 0],
    ['Paypal', 'full', 'A', '', 18, 0, conf.pricing.half_adult],
    ['Paypal', 'full', 'A', '', 11, 0, conf.pricing.half_teen],
    ['Paypal', 'full', 'A', '', 3, 0, 0],
  
    // Different ages for different meals
    ['Paypal', 'full', 'F', 'F', 18, 0, conf.pricing.full_adult + conf.pricing.meals_adult_full],
    ['Paypal', 'full', 'F', 'F', 11, 0, conf.pricing.full_teen  + conf.pricing.meals_teen_full ],
    ['Paypal', 'full', 'F', 'F', 3, 0, conf.pricing.meals_teen_full],

    ['Paypal', 'full', 'F', 'D', 18, 0, conf.pricing.full_adult + conf.pricing.meals_adult_dinners],
    ['Paypal', 'full', 'F', 'D', 11, 0, conf.pricing.full_teen  + conf.pricing.meals_teen_dinners],
    ['Paypal', 'full', 'F', 'D', 3, 0,  conf.pricing.meals_teen_dinners],

    ['Paypal', 'full', 'A', 'A', 18, 0, conf.pricing.half_adult + conf.pricing.meals_adult_half],
    ['Paypal', 'full', 'A', 'A', 11, 0, conf.pricing.half_teen  + conf.pricing.meals_teen_half],
    ['Paypal', 'full', 'A', 'A', 3, 0,  conf.pricing.meals_teen_half],

		// Deposit Logic
		['Paypal', 'deposit', 'F', '', 18, 0, conf.pricing.full_adult / 2],
		['Paypal', 'deposit', 'F', '', 11, 0, conf.pricing.full_teen / 2],
		['Paypal', 'deposit', 'F', 'D', 11, 0, (conf.pricing.full_teen / 2) + conf.pricing.meals_teen_dinners],
  
    // Parking Pass
    ['Paypal', 'full', 'F', '', 18, 1, conf.pricing.full_adult + conf.pricing.parking_pass],
  ];

  truthTable.forEach((entry) => {
    it(`correctly prices ${entry.join(', ')}`, () => {
      const [payment_type, payment_full_or_deposit, session, meal_plan, age, numPasses, price] = entry;

			const state = {
				config: conf,
				formData: {
					payment_type,
					payment_full_or_deposit,
					campers: [
						{
							session,
							age,
							meals: {
								meal_plan,
							}
						}
					],
					parking_passes: Array(numPasses).fill({}),
				}
			};

      expect(calculatePrice(state).total).toEqual(price);
    });
  });
});



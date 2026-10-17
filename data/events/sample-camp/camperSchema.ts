import { ages } from './pricing/camperPricingLogic.ts';

export const shirtSizes = ['Small', 'Medium', 'Large', 'X-Large'];
export const diets = ['Vegetarian', 'Vegan', 'Gluten free', 'Nut free'];

// The camper form: text, a required choice the pricing reads (with a
// default among its choices), formats (email, date), a $ref to a
// definition in the registration schema, a multiple choice, and a section
// that appears only when its first question is answered (dependencies).
export default {
  type: 'object',
  required: ['first_name', 'last_name', 'age'],
  properties: {
    first_name: { type: 'string', title: 'First name', maxLength: 50 },
    last_name: { type: 'string', title: 'Last name', maxLength: 50 },
    age: {
      type: 'string',
      title: 'Age at the start of camp',
      enum: Object.values(ages),
      default: ages.adult,
    },
    email: { type: 'string', format: 'email', title: 'Email' },
    phone: { $ref: '#/definitions/phone' },
    arrival: {
      type: 'string',
      format: 'date',
      title: 'Arrival date',
      description: 'Camp runs {{camp_dates}}.',
    },
    diet: {
      type: 'array',
      title: 'Dietary needs',
      items: { type: 'string', enum: diets },
      uniqueItems: true,
    },
    t_shirt: {
      type: 'object',
      title: 'Camp T-shirt',
      description: 'T-shirts are ${{pricing.t_shirt}} each.',
      properties: {
        wanted: { type: 'boolean', title: 'I would like a camp T-shirt', default: false },
      },
      dependencies: {
        wanted: {
          oneOf: [
            { properties: { wanted: { const: false } } },
            {
              properties: {
                wanted: { const: true },
                size: { type: 'string', title: 'Size', enum: shirtSizes },
              },
              required: ['size'],
            },
          ],
        },
      },
    },
  },
};

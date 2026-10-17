import { year } from './dates.ts';

export const howHeard = ['A friend', 'Social media', 'A poster', 'I have been before'];

// The registration form. Descriptions are Handlebars, rendered with the
// event's template variables (templateVars.ts) and its prices.
export default {
  title: `Sample Camp ${year} Registration`,
  description: `
**Camp runs {{camp_dates}}.**

| Lodging | Adult | Youth (5-17) | Child (0-4) |
| ------- | ----- | ------------ | ----------- |
| Meadow Cabins | \${{pricing.adult_cabin}} | \${{pricing.youth_cabin}} | free |
| Tent Field | \${{pricing.adult_tent}} | \${{pricing.youth_tent}} | free |
| Day Visitor | \${{pricing.adult_day}} | \${{pricing.youth_day}} | free |

Fields marked with an asterisk (*) are required.
`,
  type: 'object',
  definitions: {
    phone: {
      type: 'string',
      title: 'Phone number',
      maxLength: 20,
      pattern: '^\\+[0-9]+$',
    },
    address: {
      type: 'object',
      title: 'Mailing address',
      required: ['street_address', 'city', 'state_or_province', 'zip_code'],
      properties: {
        street_address: { type: 'string', title: 'Street address', maxLength: 100 },
        city: { type: 'string', title: 'City', maxLength: 50 },
        state_or_province: { type: 'string', title: 'State or province', maxLength: 50 },
        zip_code: { type: 'string', title: 'ZIP or postal code', maxLength: 10 },
      },
    },
  },
  required: ['campers', 'address'],
  properties: {
    address: { $ref: '#/definitions/address' },
    how_heard: { type: 'string', title: 'How did you hear about Sample Camp?', enum: howHeard },
    donation: {
      type: 'integer',
      minimum: 0,
      title: 'Scholarship fund donation (dollars)',
      description: 'Helps a camper who couldn\'t otherwise come.',
    },
    comments: { type: 'string', title: 'Comments', maxLength: 500 },
  },
};

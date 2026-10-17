import { dates, year } from './dates.ts';

export const howHeard = ['A friend', 'Social media', 'A poster', 'I have been before'];

// The week at camp, a day to a column. It's wider than a phone's screen, as
// some events' tables are, so the e2e tests check that it scrolls in a box of
// its own rather than widening the page.
const week = [
  { afternoon: 'Arrival', evening: 'Potluck' },
  { morning: 'Classes', afternoon: 'Workshops', evening: 'Dance' },
  { morning: 'Classes', afternoon: 'Workshops', evening: 'Concert' },
  { morning: 'Classes', afternoon: 'Swimming', evening: 'Dance' },
  { morning: 'Classes', afternoon: 'Workshops', evening: 'Talent show' },
  { morning: 'Classes', afternoon: 'Workshops', evening: 'Farewell dance' },
  { morning: 'Departure' },
];
const day = (index: number) => dates.start.plus({ days: index }).toFormat('ccc', { locale: 'en-US' });
const row = (cells: string[]) => `| ${cells.join(' | ')} |`;
const schedule = [
  row(['', ...week.map((_, index) => day(index))]),
  row(['', ...week].map(() => '---')),
  row(['Morning', ...week.map(({ morning }) => morning ?? '')]),
  row(['Afternoon', ...week.map(({ afternoon }) => afternoon ?? '')]),
  row(['Evening', ...week.map(({ evening }) => evening ?? '')]),
].join('\n');

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

**The week at camp:**

${schedule}

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

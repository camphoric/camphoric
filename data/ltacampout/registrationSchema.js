import { year, dates } from './dates.js';

const ordinate = (i) => {
  const j = i % 10;
  const k = i % 100;
  let ordinal = 'th';

  if (j === 1 && k !== 11) {
    ordinal = 'st';
  }
  if (j === 2 && k !== 12) {
    ordinal = 'nd';
  }
  if (j === 3 && k !== 13) {
    ordinal = 'rd';
  }

  return `${i}${ordinal}`;
};

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dateFormat = (d) => {
  const month = months[d.getMonth()];
  const day = ordinate(d.getDate());
  const dow = daysOfWeek[d.getDay()];

  return `${dow} ${month} ${day}`;
};


export default {
  'title': `Jughandle Campout ${year} Registration`,
  'description': `
**${dateFormat(dates.start)} to ${dateFormat(dates.end)}**    

Read the [Terms of Registration](https://docs.google.com/document/d/1pq2i2rHpHnsoB8kqtpH7FFn50JA-XELaRRMHh4hdTFg/edit?usp=sharing)
before you fill out this form.

Please note that registrations are accepted in the order they are received and
your camping preferences are processed on a "first come - first served" basis.

| Pricing | 26+ years old | 5-25 years old | 0-4 years old |
| ------- | ------------- | -------------- | ------------- |
| Shared Room | $200 | $100 | $0 |
| Private Room | $250 | $125 | $0 |
| RV/Tent camping | $150 | $75 | $0 |
| Lodging Off-site | $75 | $75 | $0 |

Fields marked with an asterisk (*) are required.
`,
  'type': 'object',
  'definitions': {
    'natural': {
      'type': 'integer',
      'minimum': 0,
      'default': 0
    },
  },
  'required': [
    'campers'
  ],
  'properties': {
    'lta_donation': {
      'type': 'integer',
      'minimum': 0,
      'title': 'Donation to Lark Traditional Arts (Tax Deductible, Dollars)',
      'description': 'Lark Traditional Arts (EIN 83-2424940) is the nonprofit organization that runs Jughandle Campout. If you would like to support camp with a tax-deductible donation in addition to your registration today, please use the space below to add the amount.',
    },
    'how_did_you_hear': {
      'type': 'string',
      'maxLength': 50,
      'title': 'How did you hear about the Jughandle Campout?'
    },
    'comments': {
      'type': 'string',
      'maxLength': 500,
      'title': 'Comments'
    }
  }
};

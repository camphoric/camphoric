import { year, dates } from './dates.js';
import { pricingMatrix } from './pricing/pricing.js';


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

| Pricing | 26+ years old | 18-25 years old | 5-17 years old | 0-4 years old |
| ------- | ------------- | --------------- | -------------- | ------------- |
| Shared Room | $${pricingMatrix.adult.sharedroom} | $${pricingMatrix.yadult.sharedroom} | $${pricingMatrix.child.sharedroom} | $${pricingMatrix.baby.sharedroom} |
| Private Room | $${pricingMatrix.adult.privateroom} | $${pricingMatrix.yadult.privateroom} | $${pricingMatrix.child.privateroom} | $${pricingMatrix.baby.privateroom} |
| Premium Suite<sup>†</sup> | $${pricingMatrix.adult.premium} | $${pricingMatrix.yadult.premium} | $${pricingMatrix.child.premium} | $${pricingMatrix.baby.premium} |
| RV/Tent camping | $${pricingMatrix.adult.tent} | $${pricingMatrix.yadult.tent} | $${pricingMatrix.child.tent} | $${pricingMatrix.baby.tent} |
| Lodging Off-site | $${pricingMatrix.adult.offsite} | $${pricingMatrix.yadult.offsite} | $${pricingMatrix.child.offsite} | $${pricingMatrix.baby.offsite} |

† Premium suites must be booked with 2 or more people

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

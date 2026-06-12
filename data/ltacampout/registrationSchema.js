import { year, dates } from './dates.js';
import { pricingMatrix } from './pricing/pricing.js';

const dateFormat = (d) => {
  return d.toFormat("EEEE MMMM d 'at' t");
};

export default {
  'title': `Jughandle Campout ${year} Registration`,
  'description': `
**${dateFormat(dates.start)} to ${dateFormat(dates.end)}**    

Read the [Terms of Registration](https://docs.google.com/document/d/1pq2i2rHpHnsoB8kqtpH7FFn50JA-XELaRRMHh4hdTFg/edit?usp=sharing)
before you fill out this form.

Please note that campers must produce a negative COVID test taken within 48 hours of arriving at camp.

Registrations are accepted in the order they are received and your camping
preferences are processed on a "first-come, first-served basis" basis.

| Pricing | 26+ years old | 18-25 years old | 5-17 years old | 0-4 years old |
| ------- | ------------- | --------------- | -------------- | ------------- |
| Shared Room | $${pricingMatrix.adult.sharedroom} | $${pricingMatrix.yadult.sharedroom} | $${pricingMatrix.child.sharedroom} | $${pricingMatrix.baby.sharedroom} |
| Private Room | $${pricingMatrix.adult.privateroom} | $${pricingMatrix.yadult.privateroom} | $${pricingMatrix.child.privateroom} | $${pricingMatrix.baby.privateroom} |
| Premium Suite<sup>†</sup> | $${pricingMatrix.adult.premium} | $${pricingMatrix.yadult.premium} | $${pricingMatrix.child.premium} | $${pricingMatrix.baby.premium} |
| RV/Tent Camping | $${pricingMatrix.adult.tent} | $${pricingMatrix.yadult.tent} | $${pricingMatrix.child.tent} | $${pricingMatrix.baby.tent} |
| Lodging Off Site - Full Camp | $${pricingMatrix.adult.offsitefull} | $${pricingMatrix.yadult.offsitefull} | $${pricingMatrix.child.offsitefull} | $${pricingMatrix.baby.offsitefull} |
| Lodging Off Site - Single Day | $${pricingMatrix.adult.offsiteday} | $${pricingMatrix.yadult.offsiteday} | $${pricingMatrix.child.offsiteday} | $${pricingMatrix.baby.offsiteday} |

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

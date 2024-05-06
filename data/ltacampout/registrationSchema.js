import { year } from './dates.js'

export default {
  'title': `Jughandle Campout ${year} Registration`,
  'description': `
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

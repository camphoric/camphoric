import { year } from './dates.js';
import countries from '../countries.js';

export default {
  'title': `Lark Camp ${year} Registration`,
  'description': `
Read the [Terms of Registration](http://www.larkcamp.org/campterms.html) before you fill out this form.

Please note that registrations are accepted in the order they are received and
your camping preferences are processed on a "first-come, first-served basis" basis.  

### PROOF OF NEGATIVE COVID TEST JUST BEFORE CAMP WILL BE REQUIRED FOR ALL ATTENDEES

Campers must produce a negative COVID test taken WITHIN 48 HOURS before
arriving at camp. We highly recommend you also get vaccinated against COVID for
additional protection. Everyone comes at their own risk. Updates based on CDC
recommendations may be sent out shortly before camp.


\\* indicates a required field
`,
  'type': 'object',
  'definitions': {
    'natural': {
      'type': 'integer',
      'minimum': 0,
      'default': 0
    },
    'address': {
      'type': 'object',
      'title': 'Address',
      'properties': {
        'street_address': {
          'type': 'string',
          'maxLength': 50,
          'title': 'Address'
        },
        'city': {
          'type': 'string',
          'maxLength': 50,
          'title': 'City'
        },
        'state_or_province': {
          'type': 'string',
          'maxLength': 50,
          'title': 'State or Province'
        },
        'zip_code':     {
          'type': 'string',
          'minLength': 3,
          'maxLength': 10,
          'title': 'ZIP code or Postal Code'
        },
        'country': {
          'type': 'string',
          'title': 'Country',
          'enum': countries,
          'default': 'United States'
        }
      },
      'required': ['street_address', 'city', 'state_or_province', 'zip_code', 'country']
    },
  },
  'required': [
    'campers', 'payment',
  ],
  'properties': {
    'payment': {
      'title': 'Payment information',
      'type': 'object',
      'required': [
        'payer_first_name', 'payer_last_name', 'payer_number',
      ],
      'properties': {
        'payer_first_name': {
          'type': 'string',
          'maxLength': 50,
          'title': 'Billing First Name'
        },
        'payer_last_name': {
          'type': 'string',
          'maxLength': 50,
          'title': 'Billing Last Name'
        },
        'payer_billing_address': {
          'title': 'Billing Address',
          '$ref': '#/definitions/address'
        },
        'payer_number': {
          'type': 'string',
          'maxLength': 20,
          'pattern': '^\\+[0-9]+$',
          'title': 'Phone Number'
        },
      },
    },
    'lta_donation': {
      'type': 'integer',
      'minimum': 0,
      'maximum': 10000,
      'title': 'Donation to Lark Traditional Arts (Tax Deductible, Dollars)',
      'description': 'Lark Traditional Arts (EIN 83-2424940) is the nonprofit organization that runs Lark Camp. If you would like to support camp with a tax-deductible donation in addition to your registration today, please use the space below to add the amount. Or you may go to: [https://www.larkcamp.org/](https://www.larkcamp.org/)',
    },
    'how_did_you_hear': {
      'type': 'string',
      'maxLength': 50,
      'title': 'How did you hear about Lark Camp?'
    },
    'comments': {
      'type': 'string',
      'maxLength': 500,
      'title': 'Comments'
    },
  }
};

import { DateTime } from 'luxon';
import { dates, yearDisplay } from './dates.js';
import countries from '../countries.js';

// luxon DATE_HUGE = Friday, October 14, 1983
const start = dates.start.toLocaleString(DateTime.DATE_HUGE);
const end = dates.end.toLocaleString(DateTime.DATE_HUGE);

export default {
  'title': `Camp Harmony ${yearDisplay} Registration`,
  'description': `
${start} through ${end}

Please note that registrations are accepted in the order they are received and your housing preferences are processed on a "first-come, first-served basis" basis.

**COVID AND CANCELLATION POLICIES**    

Please read [Camp Harmony's Covid and Cancellation policies](https://docs.google.com/document/d/1UF2jpUABv2akG4FuNsoWhrIa4OSBNvtb/edit).
All Campers will need to test before arriving at Camp.

Fields marked with an asterisk (*) are required
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
          'default': 'United States',
        },
      },
      'required': ['street_address', 'city', 'state_or_province', 'zip_code', 'country']
    },
  },
  'required': [
    'campers',
    'address',
  ],
  'properties': {
    'comments': {
      'type': 'string',
      'maxLength': 500,
      'title': 'Comments'
    },
    'address': {
      'title': 'Main Address',
      '$ref': '#/definitions/address'
    },
    'campership_donation': {
      'title': 'Campership Donation',
      'description': 'If you would like to help fellow campers attend, please make a contribution to the Campership fund.',
      'type': 'integer',
      'minimum': 0,
      'default': 0,
    },
    'is_member': {
      'title': 'SFFMC Membership',
      'description': `Current San Francisco Folk Music Club membership is
required to attend Camp Harmony.  Please verify that you are a current member
by [clicking here](https://www.sffmc.org/log-in/?redirect_to=https%3A%2F%2Fwww.sffmc.org%2Fmembership-account%2F)
to log into the site to check your expiration or auto-renew date.  If you don't
know your password or haven't logged in before, click the "Lost Password" link
to request a new password.  If you believe you are a member but are unable to
log in even after requesting a new password, contact SFFMC membership secretary
Ellen Eagan at [membership@sffmc.org](mailto:membership@sffmc.org) for
assistance.  If you are new to the Folk Club, join us by clicking “become a
member” under the “Join Us!” tab.
`,
      'type': 'boolean',
    },
  }
};

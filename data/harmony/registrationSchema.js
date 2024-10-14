import { dates, yearDisplay } from './dates.js';

const start = dates.start.toLocaleDateString('en-us', { weekday:'long', year:'numeric', month:'short', day:'numeric'});
const end = dates.end.toLocaleDateString('en-us', { weekday:'long', year:'numeric', month:'short', day:'numeric'});

export default {
  'title': `Camp Harmony ${yearDisplay} Registration`,
  'description': `
${start}-${end}

Please note that registrations are accepted in the order they are received and your housing preferences are processed on a "first come - first served" basis.

**COVID AND CANCELLATION POLICIES**    

Please read [Camp Harmony's Covid and Cancellation policies](https://docs.google.com/document/d/134EIqyOK5xXswp5EEbNRw0gBrr-TvUsh/edit?usp=sharing&ouid=112175546889387017762&rtpof=true&sd=true).
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
  },
  'required': [
    'campers',
    'membership_check'
  ],
  'properties': {
    'comments': {
      'type': 'string',
      'maxLength': 500,
      'title': 'Comments'
    },
    'campership_donation': {
      'title': 'Campership Donation',
      'description': 'If you would like to help fellow campers attend, please make a contribution to the Campership fund.',
      'type': 'integer',
      'minimum': 0,
      'default': 0,
    },
    'membership_check': {
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
      'type': 'string',
      'enum': [
        'No, I am not yet a member',
        'Yes, I am a current member',
      ]
    },
  }
};

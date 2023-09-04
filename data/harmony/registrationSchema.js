export default {
  'title': 'Camp Harmony 2023-24 Registration',
  'description': `
December 27, 2023-January 1 2024

Please note that registrations are accepted in the order they are received and your housing preferences are processed on a "first come - first served" basis.

**COVID AND CANCELLATION POLICIES**    

Please read [Camp Harmony's Covid and Cancellation policies](https://docs.google.com/document/d/1ZkH9LfwmN-tVrOpoEXuB5BM0s9LdgOX5eJTP0pCiFiA/edit?usp=sharing).
All Campers will need to test before arriving at Camp.

**LODGING**    

[Click here to see 2023-24 rates](https://docs.google.com/spreadsheets/d/1UvAbUg8KC5nCQWtYNe_V5Jecb3OtHC3lrn-_nBYHKxI/edit?usp=sharing) for lodging (all prices include meals)
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
      'description': `San Francisco Folk Club Membership is required to attend Camp Harmony.
To verify that your registration is current, please
[click here](https://www.sffmc.org/log-in/?redirect_to=https%3A%2F%2Fwww.sffmc.org%2Fmembership-account%2F)
and follow prompts to request a password.  Once you are logged into the site
you will see your membership level and expiration date.  If you are new to the
Folk Club, click “become a member” under the “Join Us!” tab.  Please verify that you are a member
`,
      'type': 'string',
      'enum': [
        'No, I am not yet a member',
        'Yes, I am a current memeber',
      ]
    },
  }
};

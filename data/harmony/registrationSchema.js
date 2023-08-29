export default {
  'title': 'Camp Harmony 2023-24 Registration',
  'description': `
December 27, 2023-January 1 2024

Please note that registrations are accepted in the order they are received and your housing preferences are processed on a "first come - first served" basis.

COVID POLICY

It is our goal to hold a safe and fun Camp Harmony for our community. Although there is always some risk of exposure to COVID when gathering in groups, we are taking the following actions to minimize the risk:

- We will follow the current County and State Public Health COVID safety guidelines. (to be updated the day registration open) https://covid19.ca.gov/safely-reopening/#what-to-do-now
- Starting five days before camp starts, please start being extra COVID conscious. For example, wear N95 masks when you are in indoor spaces like grocery stores, and avoid indoor activities where you can’t wear a mask. Your care helps protect our community, some of whom, although vaccinated, are older or immunocompromised and really need to avoid the possibility of long COVID.
- December 24, three days before camp, we highly recommend and appreciate your testing!
- The day you plan to arrive at Camp, you must take a rapid COVID test and show a time-dated picture of yourself with your negative test at camp check-in. (We do not recommend waiting to test until you get to camp — please test before you drive to camp.) If you test positive for COVID before camp, a full refund less a $25 per-camper administration fee will be offered.
- At camp, masks are optional and all choices are respected. We recommend every attendee bring 1-2 well-fitting N95, KF94 or better masks with them to camp to use in the event that someone tests positive during camp.
- If someone tests positive at camp, we will be transparent and create a plan on a case-by-case basis because there are many variables to take into consideration.
- For five days after camp ends, if you test positive for COVID, please let us (campnewharmony@gmail.com) know, so that we can alert the community to re-test and quarantine as needed.
- Vaccination and proof of vaccination are no longer required to attend camp. 

CANCELLATION POLICY

Any registered camper can cancel for any reason by December 10 and receive a full refund.  If you are sick or experiencing symptoms, do not come to camp.  Your registration will be fully refunded if you cancel due to illness at any time before camp. If you begin to experience symptoms at camp, we ask that you notify registration and leave immediately; the remainder of your fees will be refunded.  
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

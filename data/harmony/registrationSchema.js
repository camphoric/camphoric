import { DateTime } from 'luxon';

import { dates, yearDisplay } from './dates.js';

// luxon DATE_HUGE = Friday, October 14, 1983
const start = dates.start.toLocaleString(DateTime.DATE_HUGE);
const end = dates.end.toLocaleString(DateTime.DATE_HUGE);

export default {
  'title': `Camp Harmony ${yearDisplay} Registration`,
  'description': `
${start} through ${end}

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
          'title': 'Zipcode or Postal Code'
        },
        'country': {
          'type': 'string',
          'title': 'Country',
          'enum': [ 'Afghanistan', 'Åland Islands', 'Albania', 'Algeria', 'American Samoa', 'Andorra', 'Angola', 'Anguilla', 'Antarctica', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Aruba', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bermuda', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Bouvet Island', 'Brazil', 'British Indian Ocean Territory', 'Brunei Darussalam', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada', 'Cape Verde', 'Cayman Islands', 'Central African Republic', 'Chad', 'Chile', 'China', 'Christmas Island', 'Cocos (Keeling) Islands', 'Colombia', 'Comoros', 'Congo', 'Congo, The Democratic Republic of the', 'Cook Islands', 'Costa Rica', 'Côte_d\'Ivoire', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Ethiopia', 'Falkland Islands (Malvinas)', 'Faroe Islands', 'Fiji', 'Finland', 'France', 'French Guiana', 'French Polynesia', 'French Southern Territories', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Gibraltar', 'Greece', 'Greenland', 'Grenada', 'Guadeloupe', 'Guam', 'Guatemala', 'Guernsey', 'Guinea', 'Guinea-bissau', 'Guyana', 'Haiti', 'Heard Island and Mcdonald Islands', 'Holy See (Vatican City State)', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran, Islamic Republic of', 'Iraq', 'Ireland', 'Isle of Man', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jersey', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Korea, Democratic People\'s Republic of', 'Korea, Republic of', 'Kuwait', 'Kyrgyzstan', 'Lao People\'s Democratic Republic', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libyan Arab Jamahiriya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Macao', 'Macedonia, The Former Yugoslav Republic of', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Martinique', 'Mauritania', 'Mauritius', 'Mayotte', 'Mexico', 'Micronesia, Federated States of', 'Moldova, Republic of', 'Monaco', 'Mongolia', 'Montenegro', 'Montserrat', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'Netherlands Antilles', 'New Caledonia', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'Niue', 'Norfolk Island', 'Northern Mariana Islands', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestinian Territory', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Pitcairn', 'Poland', 'Portugal', 'Puerto Rico', 'Qatar', 'Reunion', 'Romania', 'Russian Federation', 'Rwanda', 'Saint Barthélemy', 'Saint Helena', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Martin', 'Saint Pierre and Miquelon', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Georgia and the South Sandwich Islands', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Svalbard and Jan Mayen', 'Swaziland', 'Sweden', 'Switzerland', 'Syrian Arab Republic', 'Taiwan, Republic of China', 'Tajikistan', 'Tanzania, United Republic of', 'Thailand', 'Timor-leste', 'Togo', 'Tokelau', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Turks and Caicos Islands', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'United States Minor Outlying Islands', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Venezuela', 'Vietnam', 'Virgin Islands, British', 'Virgin Islands, U.S.', 'Wallis and Futuna', 'Western Sahara', 'Yemen', 'Zambia', 'Zimbabwe' ],
          'default': 'United States',
        },
      },
      'required': ['street_address', 'city', 'state_or_province', 'zip_code', 'country']
    },
  },
  'required': [
    'campers',
    'membership_check',
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

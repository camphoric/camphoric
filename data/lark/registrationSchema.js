import { year } from './dates.js';

export default {
  'title': `Lark Camp ${year} Registration`,
  'description': `
Read the [Terms of Registration](http://www.larkcamp.org/campterms.html) before you fill out this form.

Please note that registrations are accepted in the order they are received and
your camping preferences are processed on a "first come - first served" basis.  

### PROOF OF NEGATIVE COVID TEST JUST BEFORE CAMP WILL BE REQUIRED FOR ALL ATTENDEES

Campers must produce a negative COVID test taken WITHIN 48 HOURS before
arriving at camp. We highly recommend you also get vaccinated against COVID for
additional protection. Everyone comes at their own risk. Updates based on CDC
recommendations may be sent out shortly before camp.
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
    }
  }
};

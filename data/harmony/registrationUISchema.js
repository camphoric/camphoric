const lodgingDescription = `
[Click here to see the current rates](https://docs.google.com/spreadsheets/d/1yZ_e924wB-26Znmz4pzBYgkW6Zt8erobgKvM6H90oo0/edit?gid=417741577) for lodging (all prices include meals)

For Lodge: Linens included. Preference given to campers staying for full camp.
`;


export default {
  'ui:order': [
    'registrant_email',
    'address',
    'payment_type',
    'paypal_email',
    'campers',
    'membership_check',
    'campership_donation',
    'comments',
  ],
  'campers': {
    // For some reason the title and description have to stay in the
    // ui-schema, or their duplicated for each camper
    'ui:title': 'Camper Information',
    'ui:description': 'There is a big blue button below to add additional campers.',
    'ui:field': 'Campers',
    'ui:options': {
      'orderable': false
    },
    'items': {
      'ui:order': [
        'first_name',
        'last_name',
        'age',
        'email',
        'phone',
        'address_different_than_payer',
        'address',
        'emergency_contact',
        'attendance',
        'driving',
        'license_plate',
        'mobile_phone',
        'lodging',
        'linens',
        'meal_type',
        'meal_exceptions',
        'meal_exceptions_other',
        'health_conditions',
        'first_time',
        'referer',
        '*',
      ],
      'phone': {
        'ui:widget': 'PhoneInput'
      },
      'emergency_contact': {
        'ui:order': [
          'name',
          'phone',
        ],
        'phone': {
          'ui:widget': 'PhoneInput'
        },
      },
      'mobile_phone': {
        'ui:widget': 'PhoneInput'
      },
      'attendance': {
        'ui:widget': 'checkboxes'
      },
      'meal_exceptions': {
        'ui:widget': 'checkboxes'
      },
			'driving': {
				'ui:placeholder': 'Choose an option',
			},
      'health_conditions': {
        'ui:widget': 'textarea',
        'ui:options': {
          'rows': 3
        }
      },
      'meal_exceptions_other': {
        'ui:widget': 'textarea',
        'ui:options': {
          'rows': 5
        }
      },
      'lodging': {
        'ui:description': lodgingDescription,
      },
      'campership_request': {
        'ui:options': { 'prefix': '$' },
      },
    },
  },
  'campership_donation': {
    'ui:options': { 'prefix': '$' },
  },
  'membership_check': {
    'ui:placeholder': 'Choose an option',
  },
  'comments': {
    'ui:widget': 'textarea',
    'ui:options': {
      'rows': 5
    }
  },
};

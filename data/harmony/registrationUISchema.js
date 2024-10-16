const lodgingDescription = `
[Click here to see the current rates](https://docs.google.com/spreadsheets/d/1Ib164P-xt45RVV6UKnngH32_hiXLkYOgDgb9xhEK1u4/edit?gid=417741577#gid=417741577) for lodging (all prices include meals)

For Lodge: Linens included. Preference given to campers staying for full camp.
`;


export default {
  'ui:order': [
    'registrant_email',
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
        'attendance',
        'driving',
        'license_plate',
        'mobile_phone',
        'lodging',
        'linens',
        'meal_type',
        'meal_exceptions',
        'meal_exceptions_other',
        '*',
      ],
      'phone': {
        'ui:widget': 'PhoneInput'
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

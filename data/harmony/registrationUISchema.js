const lodgingDescription = `
[Click here to see the current rates](https://docs.google.com/spreadsheets/d/1Z-GSxRMS7SnyC32F9v7MVNaE3UxjcmdXBSswUjp6HPc/edit?usp=sharing) for lodging (all prices include meals)

For Lodge: Linens included. Preference given to campers staying for full camp.
`;

const lodgingCommentsDescription= `
Do you have mobility issues? Can you climb stairs?
`;

export default {
  'ui:order': [
    'registrant_email',
    'address',
    'payment_type',
    'paypal_email',
    'campers',
    'is_member',
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
        'disabled_parking',
        'license_plate',
        'mobile_phone',
        'lodging',
        'lodging_private',
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
      'disabled_parking': {
        'ui:enumNames': {
          false: 'No, I will not be parking with a State disabled parking placard, or I do not need disabled parking',
          true: 'Yes, I will be parking with a State disabled parking placard, and would like disabled parking',
        },
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
      'first_time': {
        'ui:enumNames': {
          false: 'No',
          true: 'Yes',
        },
      },
      'meal_exceptions_other': {
        'ui:widget': 'textarea',
        'ui:options': {
          'rows': 5
        }
      },
      'lodging': {
        'ui:description': lodgingDescription,
        'lodging_comments': {
          'ui:description': lodgingCommentsDescription,
        },
      },
      'lodging_private': {
        'ui:enumNames': {
          false: 'No, I do not want a private room',
          true: 'Yes, I would like a private room',
        },
      },
      'linens': {
        'ui:enumNames': {
          false: 'No, I do not need to rent linens',
          true: 'Yes, I would like to rent linens',
        },
      },
      'campership_request': {
        'ui:options': { 'prefix': '$' },
      },
    },
  },
  'campership_donation': {
    'ui:options': { 'prefix': '$' },
  },
  'is_member': {
    'ui:placeholder': 'Choose an option',
    'ui:enumNames': {
      false: 'No, I am not yet a member',
      true: 'Yes, I am a current member',
    },
  },
  'comments': {
    'ui:widget': 'textarea',
    'ui:options': {
      'rows': 5
    }
  },
};

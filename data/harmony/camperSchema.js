import { dates } from './dates.js';

export const days = [0, 1, 2, 3, 4]
  .map((i) => dates.start.plus({days: i}).toFormat('EEE MMM d'));

// export default (args) => ({
export default {
  'type': 'object',
  'required': ['first_name', 'last_name', 'email', 'phone', 'driving', 'attendance'],
  'dependencies': {
    'address_different_than_payer': {
      'oneOf': [
        {
          'properties': {
            'address_different_than_payer': {
              'enum': [false, ''],
            },
          },
        },
        {
          'properties': {
            'address_different_than_payer': {
              'enum': [true],
            },
            'address': {
              'title': 'Address',
              '$ref': '#/definitions/address'
            },
          },
          'required': ['address'],
        },
      ],
    },
    'first_time': {
      'allOf': [
        {
          'if': {
            'properties': { 'first_time': { 'const': true } }
          },
          'then': {
            'properties': {
              'referer': {
                'type': 'string',
                'maxLength': 30,
                'title': 'If a particular person encouraged you to attend, please tell us who referred you.',
              },
            },
          },
        },
      ],
    },
    'driving': {
      'allOf': [
        {
          'if': {
            'properties': { 'driving': { 'const': 'Driver' } }
          },
          'then': {
            'properties': {
              'license_plate': {
                'type': 'string',
                'maxLength': 10,
                'title': 'License Plate',
                'description': 'Provide the license plate for the car you will be driving to camp',
              },
              'mobile_phone': {
                'type': 'string',
                'maxLength': 20,
                'pattern': '^\\+[0-9]+$',
                'title': 'Mobile Phone Number',
                'description': 'If we need to reach you during camp',
              },
            },
          },
        },
      ],
    },
  },
  'properties': {
    'first_name': {
      'type': 'string',
      'maxLength': 50,
      'title': 'First name'
    },
    'last_name': {
      'type': 'string',
      'maxLength': 50,
      'title': 'Last name'
    },
    'age': {
      'type': 'string',
      'title': 'Age (at the beginning of camp)',
      'enum': [
        '70+ years old',
        '31-69 years old',
        '18-30 years old',
        '13-17 years old',
        '3-12 years old',
        '0-2 years old',
      ],
      'default': '70+ years old',
    },
    'email': {
      'title': 'Camper Email',
      'type': 'string',
      'format': 'email',
    },
    'phone': {
      'type': 'string',
      'maxLength': 20,
      'pattern': '^\\+[0-9]+$',
      'title': 'Phone Number'
    },
    'address_different_than_payer': {
      'type': 'boolean',
      'title': 'This camper\'s address is different than the main address',
      'enum': [false, true],
      'enumNames': ['No', 'Yes'],
      'default': false,
    },
    'emergency_contact': {
      'title': 'Emergency Contact',
      'type': 'object',
      'properties': {
        'phone': {
          'type': 'string',
          'maxLength': 20,
          'pattern': '^\\+[0-9]+$',
          'title': 'Phone Number'
        },
        'name': {
          'type': 'string',
          'maxLength': 50,
          'title': 'Full name'
        },
      },
    },
    'first_time': {
      'title': 'This is my first time attending Camp Harmony',
      'type': 'boolean',
      'enum': [false, true],
      'enumNames': ['No', 'Yes'],
      'default': false,
    },
    'attendance': {
      'title': 'When will you attend?',
      'description': 'Each camp day starts at 2pm and ends at 2pm the following day. Each camp day includes dinner on the day you arrive, and breakfast & lunch the following day.',
      'type': 'array',
      'items': {
        'type': 'string',
        'enum': days,
      },
      'minItems': 1,
      'uniqueItems': true
    },
    'driving': {
      'title': 'Do you expect you will be driving, or arriving as a passenger in someone\'s car?',
      'description': 'Answering this will help us with parking coordination.',
      'type': 'string',
      'enum': [
        'Driver',
        'Passenger',
        'Not sure yet',
      ],
    },

    'meal_type': {
      'title': 'Meals',
      'description': 'Camp includes 3 delicious meals a day, and camp staff can make accommodations for most dietary needs.',
      'type': 'string',
      'enum': [
        'Omnivore',
        'Vegetarian',
        'Vegan',
      ],
      'default': 'Omnivore',
    },
    'linens': {
      'title': 'Linens rental',
      'description': `
All campers should bring bedding (blankets, sleeping bag, pillow, etc). Camp
Newman will provide linens (fitted and top sheet, pillowcase, pillow, blanket
and towel) for an additional $25. Would you like to rent linens?
`,
      'type': 'string',
      'enum': [
        'Yes',
        'No',
      ],
      'default': 'No',
    },
    'meal_exceptions': {
      'title': 'Dietary needs',
      'type': 'array',
      'items': {
        'type': 'string',
        'enum': [
          'Gluten Free',
          'Dairy Free',
          'Whole Grain',
        ],
      },
      'uniqueItems': true
    },
    'meal_exceptions_other': {
      'title': 'Any additional dietary restrictions or allergies',
      'type': 'string',
    },
    'health_conditions': {
      'title': 'Non-food allergies and health conditions',
      'description': 'Camp Newman requires all campers to provide known allergies, health conditions that require treatment, restrictions, or other accommodations needed while at camp. If you have food allergies, please put them in the section above',
      'type': 'string',
      'maxLength': 200,
    },
    'campership_request': {
      'title': 'Campership request',
      'description': `
Due to generous donations to the Campership fund and sponsorship from SFFMC, we
can offer a campership discount of $60 per day (maximum $300) for those who
otherwise would not be able to attend camp, while funds last. If you
enter a number above the maximum, only the maximum will be applied.`,
      'type': 'integer',
      'minimum': 0,
      'default': 0,
    },
  },
};

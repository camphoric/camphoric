export const days = [
  'Wed Dec 27',
  'Thurs Dec 28',
  'Fri Dec 29',
  'Sat Dec 30',
  'Sun Dec 31',
];

export default {
  'type': 'object',
  'required': ['first_name', 'last_name', 'email', 'phone', 'attendance', 'campership_request'],
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
        '31+ years old',
        '18-30 years old',
        '13-17 years old',
        '3-12 years old',
        '0-2 years old',
      ],
      'default': '31+ years old',
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
    'attendance': {
      'title': 'When will you attend?',
      'description': 'Check all for full camp',
      'type': 'array',
      'items': {
        'type': 'string',
        'enum': days,
      },
      'minItems': 1,
      'uniqueItems': true
    },
    'meal_exceptions': {
      'title': 'Meals',
      'description': 'Camp includes 3 delicious meals a day, and camp staff can make accommodations for most dietary needs.  Please check any and all that apply:',
      'type': 'array',
      'items': {
        'type': 'string',
        'enum': [
          'Vegetarian',
          'Vegan',
          'Gluten Free',
          'Dairy Free',
        ],
      },
      'uniqueItems': true
    },
    'campership_request': {
      'title': 'Campership Request',
      'description': `
Due to generous donations to the Campership fund over the past 3 years, we can
offer a campership discount of half the early-bird Economy rate (maximum $300)
for those who otherwise would not be able to attend camp, while funds
last. If you enter a number above the maximum, only the maximum will be
applied.`,
      'type': 'integer',
      'minimum': 0,
      'default': 0,
    },
  }
};

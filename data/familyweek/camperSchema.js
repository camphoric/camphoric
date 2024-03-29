export default {
  'type': 'object',
  'required': ['first_name', 'last_name', 'meal_preferences'],
  'properties': {
    'first_name': {
      'type': 'string',
      'title': 'First Name',
    },
    'last_name': {
      'type': 'string',
      'title': 'Last Name',
    },
    'birthdate': {
      'type': 'string',
      'format': 'date',
      'title': 'Date of Birth (if under 18)',
    },
    'email': {
      'type': 'string',
      'format': 'email',
      'title': 'Email',
    },
    'work_trade': {
      'type': 'boolean',
      'title': 'I need a work trade discount',
    },
    'meal_preferences': {
      'type': 'object',
      'required': ['meal_type'],
      'title': 'Meal Preferences',
      'properties': {
        'meal_type': {
          'type': 'string',
          'title': 'Meal Type',
          'enumNames': ['Omnivore', 'Vegetarian'],
          'enum': ['omnivore', 'vegetarian'],
          'default': 'omnivore',
        },
        'gluten_free': {
          'type': 'boolean',
          'title': 'Gluten Free',
        },
        'dairy_free': {
          'type': 'boolean',
          'title': 'Dairy Free',
        },
        'food_allergies': {
          'type': 'boolean',
          'title': 'Food Allergies (Please provide details below)',
        },
      },
    },
    'special_needs': {
      'type': 'string',
      'title': 'Tell us about any other special needs (diet, chore restrictions, developmental or social issues, etc):',
    },
    'housing_preferences': {
      'type': 'string',
      'title': 'Tell us about your housing preferences. Housing is assigned by age, youngest children first, to facilitate an age-group cabin-mate for each child. Every attempt will be made to accommodate housing requests. Please discuss any special needs below:',
    },
  },
}

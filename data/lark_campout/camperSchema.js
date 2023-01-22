export default {
  'type': 'object',
  'required': ['first_name', 'last_name', 'email', 'phone', 'vaccination_status', 'chore'],
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
      'description': 'In order to help us abide by CDC recommendations, please select your age category at time of camp',
      'enum': [
        '65 years old or older',
        '50-64 years old',
        '26-49 years old',
        '18-25 years old',
        '12-17 years old',
        '5-11 years old',
        '0-4 years old',
      ],
      'default': '65 years old or older',
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
    'vaccination_status': {
      'title': 'Vaccination Information',
      'description': 'Please check all that apply',
      'type': 'array',
      'items': {
        'type': 'string',
        'enum': [
          'First dose',
          'Second dose',
          'Booster',
          'J&J',
          'None',
        ],
      },
      'uniqueItems': true
    },
    'chore': {
      'type': 'string',
      'title': 'Chore signup',
      'description': 'We will not have a crew as we do at Lark Camp, so we will need all campers to pitch in. We are asking that campers sign up for one chore shift during the weekend',
      'enum': [
        'Cleanup',
        'Office Hours',
        'Setup (must be able to arrive at 10am on Friday)',
        'Teardown (must be able to stay until noon on Monday)',
      ],
      'default': 'Cleanup',
    }
  }
};

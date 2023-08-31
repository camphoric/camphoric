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
      'title': 'Age',
      'description': 'Please select your age category at the beginning of camp',
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
      'title': 'COVID Vaccination Information',
      'description': 'We highly recommend you get vaccinated against COVID-19 if you attend this event. Please indicate your vaccination status so we can place you in shared housing with like-vaccinated individuals',
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
      'description': 'We require all campers to pitch in. We are asking that campers sign up for one chore shift during the weekend. [See this document](https://docs.google.com/document/d/1uHlAcjSAG112XhSPB7q_La4peZkLjsC6_CvjqhQQzNE/edit?usp=sharing) for a description of the chores.',
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

export default {
  vaccination_checked: {
    data: {
      'type': 'boolean',
      'title': 'Vaccination verified',
      'enum': [false, true],
      'enumNames': ['No', 'Yes'],
      'default': false,
    },
    ui: { },
  },

  precamp_meals_comp: {
    data: {
      'type': 'boolean',
      'title': 'Comped pre-camp meals',
      'enum': [false, true],
      'enumNames': ['No', 'Yes'],
      'default': false,
    },
    ui: { },
  },

  instructor_meal_rate: {
    data: {
      'type': 'boolean',
      'title': 'Instructor meal rate',
      'enum': [false, true],
      'enumNames': ['No', 'Yes'],
      'default': false,
    },
    ui: { },
  },

  registration_volunteer: {
    data: {
      'type': 'boolean',
      'title': 'Registration volunteer',
      'enum': [false, true],
      'enumNames': ['No', 'Yes'],
      'default': false,
    },
    ui: { },
  },

  guardian_forms_required: {
    data: {
      'type': 'boolean',
      'title': 'Guardian forms required',
      'enum': [false, true],
      'enumNames': ['No', 'Yes'],
      'default': false,
    },
    ui: { },
  },

  guardian_forms_received: {
    data: {
      'type': 'boolean',
      'title': 'Guardian forms received',
      'enum': [false, true],
      'enumNames': ['No', 'Yes'],
      'default': false,
    },
    ui: { },
  },

  guardian_name: {
    data: {
      'type': 'string',
      'title': 'Guardian name',
    },
    ui: { },
  },
};

import meals from './camperMeals.mjs';

export default {
  "type": "object",
  "required": ["first_name", "last_name", "gender"],
  "dependencies": {
    "email_different": {
      "oneOf": [
        {
          "properties": {
            "email_different": {
              "enum": [false],
            },
          },
        },
        {
          "properties": {
            "email_different": {
              "enum": [true],
            },
            "email": {
              title: "Camper Email",
              type: 'string',
              format: 'email',

            },
          },
          "required": ["email"],
        },
      ],
    },
  },
  "properties": {
    "first_name": {
      "type": "string",
      "maxLength": 50,
      "title": "First name"
    },
    "last_name": {
      "type": "string",
      "maxLength": 50,
      "title": "Last name"
    },
    "gender": {
      "type": "string",
      "title": "Gender",
      "enum": ["Male", "Female", "Other"],
    },
    "age": {
      "type": "string",
      "title": "Age (at the beginning of camp)",
      "description": "In order to help us abide by CDC recommendations, please select your age category at time of camp",
      "enum": [
        "65 years old or older",
        "50-64 years old",
        "26-49 years old",
        "18-25 years old",
        "12-17 years old",
        "5-11 years old",
        "0-4 years old",
      ],
      "default": "65 years old or older",
    },
    "email_different": {
      "type": "boolean",
      "title": "Is this campers email different than the primary email?",
      "enum": [false, true],
      "enumNames": ["No", "Yes"],
      "default": false,
    },
  }
};

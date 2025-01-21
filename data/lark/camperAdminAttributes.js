/* eslint-disable quotes */

export default 
{
  "guardian_name": {
    "ui": {},
    "data": {
      "type": "string",
      "title": "Guardian name"
    }
  },
  "food_trade_only": {
    "ui": {},
    "data": {
      "enum": [
        false,
        true
      ],
      "type": "boolean",
      "title": "Food trade only",
      "default": false,
      "enumNames": [
        "No",
        "Yes"
      ]
    }
  },
  "precamp_meals_comp": {
    "ui": {},
    "data": {
      "enum": [
        false,
        true
      ],
      "type": "boolean",
      "title": "Comped pre-camp meals",
      "default": false,
      "enumNames": [
        "No",
        "Yes"
      ]
    }
  },
  "instructor_meal_rate": {
    "ui": {},
    "data": {
      "enum": [
        false,
        true
      ],
      "type": "boolean",
      "title": "Instructor meal rate",
      "default": false,
      "enumNames": [
        "No",
        "Yes"
      ]
    }
  },
  "meal_assignment_dinner": {
    "ui": {
      "ui:placeholder": "Choose an option"
    },
    "data": {
      "enum": [
        "Camp 1",
        "Camp 2"
      ],
      "type": "string",
      "title": "Meals: Dinner in",
      "description": "If camper is not eating meals in the camp where they're staying"
    }
  },
  "registration_volunteer": {
    "ui": {},
    "data": {
      "enum": [
        false,
        true
      ],
      "type": "boolean",
      "title": "Registration volunteer",
      "default": false,
      "enumNames": [
        "No",
        "Yes"
      ]
    }
  },
  "guardian_forms_received": {
    "ui": {},
    "data": {
      "enum": [
        false,
        true
      ],
      "type": "boolean",
      "title": "Guardian forms received",
      "default": false,
      "enumNames": [
        "No",
        "Yes"
      ]
    }
  },
  "guardian_forms_required": {
    "ui": {},
    "data": {
      "enum": [
        false,
        true
      ],
      "type": "boolean",
      "title": "Guardian forms required",
      "default": false,
      "enumNames": [
        "No",
        "Yes"
      ]
    }
  },
  "meal_assignment_breakfast": {
    "ui": {
      "ui:placeholder": "Choose an option"
    },
    "data": {
      "enum": [
        "Camp 1",
        "Camp 2"
      ],
      "type": "string",
      "title": "Meals: Breakfast in",
      "description": "If camper is not eating meals in the camp where they're staying"
    }
  },
	'badge_role': {
		"data": {
			'type': 'string',
			'maxLength': 10,
			'title': 'Role for name badge'
		},
	},
};

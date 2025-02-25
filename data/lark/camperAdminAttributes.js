/* eslint-disable quotes */

export default {
  "badge_role": {
    "data": {
      "type": "string",
      "title": "Role for name badge",
      "maxLength": 10
    }
  },
  "vehicles": {
    "ui": {
      "items": {
        "ui:order": [
          "year",
          "make",
          "model",
          "color",
          "state",
          "license",
          "*"
        ]
      }
    },
    "data": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "make": {
            "type": "string",
            "title": "Make"
          },
          "year": {
            "type": "string",
            "title": "Year",
            "maxLength": 4,
            "minLength": 4
          },
          "color": {
            "type": "string",
            "title": "Color"
          },
          "model": {
            "type": "string",
            "title": "Model"
          },
          "state": {
            "type": "string",
            "title": "License Plate State",
            "default": "CA",
            "maxLength": 2,
            "minLength": 2
          },
          "license": {
            "type": "string",
            "title": "License Plate Number"
          },
          "passengers": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "title": "Passengers"
          }
        }
      },
      "title": "Registration: Vehicles"
    }
  },
  "checked_in": {
    "ui": {},
    "data": {
      "enum": [
        false,
        true
      ],
      "type": "boolean",
      "title": "Registration: Checked-In",
      "default": false,
      "enumNames": [
        "No",
        "Yes"
      ]
    }
  },
  "guardian_name": {
    "ui": {},
    "data": {
      "type": "string",
      "title": "Guardian name"
    }
  },
  "crew_exception": {
    "ui": {},
    "data": {
      "type": "string",
      "title": "Crew Exception/Title",
      "description": "Enter 'Guest' if not actually on crew, and 'Manager of <Crewname>' if manager of a crew"
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
  }
};

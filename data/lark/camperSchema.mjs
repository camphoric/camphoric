export default {
  "type": "object",
  "required": ["first_name", "last_name", "gender", "session", "meals"],
  "dependencies": {
    "address_different_than_payer": {
      "oneOf": [
        {
          "properties": {
            "address_different_than_payer": {
              "enum": [false],
            },
          },
        },
        {
          "properties": {
            "address_different_than_payer": {
              "enum": [true],
            },
            "camper_address": {
              "title": "Address",
              "$ref": "#/definitions/address"
            },
          },
          "required": ["camper_address"],
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
      "enumNames": ["Male", "Female", "Other"],
      "enum": ["M", "F", "O"]
    },
    "age": {
      "type": "integer",
      "title": "Age (at the beginning of camp)",
      "description": "In order to help us abide by CDC recommendations, please select your age category at time of camp",
      "enum": [
        65,
        64,
        49,
        25,
        17,
        11,
        4,
      ],
      "enumNames": [
        "65 years old or older",
        "50-64 years old",
        "26-49 years old",
        "18-25 years old",
        "12-17 years old",
        "5-11 years old",
        "0-4 years old",
      ],
      "default": 65,
    },
    "address_different_than_payer": {
      "type": "boolean",
      "title": "Is this campers address different than the billing address?",
      "enum": [false, true],
      "enumNames": ["No", "Yes"],
      "default": false,
    },
    "session": {
      "type": "string",
      "title": "When will you attend?",
      "description": `*Full camp* begins {full_camp_start_date_time}, and ends {full_camp_end_date_time}.  
*First half camp* begins {first_half_camp_start_date_time}, and ends {first_half_camp_end_date_time}.  
*Second half camp* begins {second_half_camp_start_date_time}, and ends {second_half_camp_end_date_time}.  

* Full camp (adult): \${{pricing.full_adult}}
* Full camp (11 and under): \${{pricing.full_teen}}
* Half camp (adult): \${{pricing.half_adult}}
* Half camp (11 and under): \${{pricing.half_teen}}
* Children under 3 are free, but may not take up a cabin bed.`,
      "enumNames": [
        "Full camp",
        "Half camp (1st half)",
        "Half camp (2nd half)",
      ],
      "enum": [
        "F",
        "A",
        "B",
      ],
      "default": "F",
    },
    "meals": {
      "$ref": "#/definitions/meals"
    }
  }
};

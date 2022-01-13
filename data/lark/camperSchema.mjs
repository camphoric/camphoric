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
            "minimum": 0,
            "maximum": 17,
            "title": "Age, if under 18"
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
        },
        "meals": {
            "$ref": "#/definitions/meals"
        }
    }
};

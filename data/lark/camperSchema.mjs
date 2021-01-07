export default {
    "type": "object",
    "required": ["first_name", "last_name", "gender", "camper_address", "session", "accommodations", "meals"],
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
        "camper_address": {
						"title": "Address",
            "$ref": "#/definitions/address"
        },
        "session": {
            "type": "string",
            "title": "When will you attend?",
					  "description": `*Full camp* begins Friday, July 31, 2020 at 3:00 pm, and ends Saturday, August 8 at 9:00am.  
*First half camp* begins Friday, July 31, 2020 at 3:00 pm and ends before noon on Tuesday, August 4.  
*Second half camp* begins at noon on Tuesday, August 4, 2020 and ends August 8 at 9:00 am.

A discount of \${{abs pricing.check_discount_full}} (\${{abs pricing.check_discount_half}} for half camp) is given if you are paying by check.

*   Full camp (adult): \${{pricing.full_adult}}
*   Full camp (11 and under): \${{pricing.full_teen}}
*   Half camp (adult): \${{pricing.half_adult}}
*   Half camp (11 and under): \${{pricing.half_teen}}`,
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
        "accommodations": {
            "$ref": "#/definitions/accommodations"
        },
        "meals": {
            "$ref": "#/definitions/meals"
        }
    }
};

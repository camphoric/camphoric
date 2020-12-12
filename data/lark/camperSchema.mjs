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
            "$ref": "#/definitions/address"
        },
        "session": {
            "type": "string",
            "title": "When will you attend?",
            "enumNames": [
                "Full camp",
                "Half camp (1st half)",
                "Half camp (2nd half)"
            ],
            "enum": [
                "F",
                "A",
                "B"
            ]
        },
        "accommodations": {
            "$ref": "#/definitions/accommodations"
        },
        "meals": {
            "$ref": "#/definitions/meals"
        }
    }
};
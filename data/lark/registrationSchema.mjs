export default {
    "title": "Lark Camp Registration",
    "type": "object",
    "definitions": {
        "camping_preference": {
            "type": "string",
            "enum": ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]
        },
        "natural": {
            "type": "integer",
            "minimum": 0,
            "default": 0
        },
        "shirt_count": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9,
            "default": 0
        },
        "sizes": {
            "type": "object",
            "title": "Sizes",
            "properties": {
                "small": { "$ref": "#/definitions/shirt_count" },
                "medium": { "$ref": "#/definitions/shirt_count" },
                "large": { "$ref": "#/definitions/shirt_count" },
                "xl": { "$ref": "#/definitions/shirt_count" },
                "xxl": { "$ref": "#/definitions/shirt_count" }
            }
        },
        "address": {
            "type": "object",
            "title": "Address",
            "properties": {
                "street_address": {
                    "type": "string",
                    "maxLength": 50,
                    "title": "Address"
                },
                "city": {
                    "type": "string",
                    "maxLength": 50,
                    "title": "City"
                },
                "state_or_province": {
                    "type": "string",
                    "maxLength": 50,
                    "title": "State or Province"
                },
                "zip_code":     {
                    "type": "string",
                    "minLength": 3,
                    "maxLength": 10,
                    "title": "Zipcode or Postal Code"
                },
                "country": {
                    "type": "string",
                    "title": "Country",
                    "enum": [ "Afghanistan", "Åland Islands", "Albania", "Algeria", "American Samoa", "Andorra", "Angola", "Anguilla", "Antarctica", "Antigua and Barbuda", "Argentina", "Armenia", "Aruba", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bermuda", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Bouvet Island", "Brazil", "British Indian Ocean Territory", "Brunei Darussalam", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Cayman Islands", "Central African Republic", "Chad", "Chile", "China", "Christmas Island", "Cocos (Keeling) Islands", "Colombia", "Comoros", "Congo", "Congo, The Democratic Republic of the", "Cook Islands", "Costa Rica", "Côte_d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia", "Falkland Islands (Malvinas)", "Faroe Islands", "Fiji", "Finland", "France", "French Guiana", "French Polynesia", "French Southern Territories", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Gibraltar", "Greece", "Greenland", "Grenada", "Guadeloupe", "Guam", "Guatemala", "Guernsey", "Guinea", "Guinea-bissau", "Guyana", "Haiti", "Heard Island and Mcdonald Islands", "Holy See (Vatican City State)", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran, Islamic Republic of", "Iraq", "Ireland", "Isle of Man", "Israel", "Italy", "Jamaica", "Japan", "Jersey", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Korea, Democratic People's Republic of", "Korea, Republic of", "Kuwait", "Kyrgyzstan", "Lao People's Democratic Republic", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libyan Arab Jamahiriya", "Liechtenstein", "Lithuania", "Luxembourg", "Macao", "Macedonia, The Former Yugoslav Republic of", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Martinique", "Mauritania", "Mauritius", "Mayotte", "Mexico", "Micronesia, Federated States of", "Moldova, Republic of", "Monaco", "Mongolia", "Montenegro", "Montserrat", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "Netherlands Antilles", "New Caledonia", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Niue", "Norfolk Island", "Northern Mariana Islands", "Norway", "Oman", "Pakistan", "Palau", "Palestinian Territory", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Pitcairn", "Poland", "Portugal", "Puerto Rico", "Qatar", "Reunion", "Romania", "Russian Federation", "Rwanda", "Saint Barthélemy", "Saint Helena", "Saint Kitts and Nevis", "Saint Lucia", "Saint Martin", "Saint Pierre and Miquelon", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Georgia and the South Sandwich Islands", "Spain", "Sri Lanka", "Sudan", "Suriname", "Svalbard and Jan Mayen", "Swaziland", "Sweden", "Switzerland", "Syrian Arab Republic", "Taiwan, Republic of China", "Tajikistan", "Tanzania, United Republic of", "Thailand", "Timor-leste", "Togo", "Tokelau", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Turks and Caicos Islands", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "United States Minor Outlying Islands", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Virgin Islands, British", "Virgin Islands, U.S.", "Wallis and Futuna", "Western Sahara", "Yemen", "Zambia", "Zimbabwe" ],
                    "default": "United States"
                }
            },
            "required": ["street_address", "city", "state_or_province", "zip_code", "country"]
        },
        "accommodations": {
            "type": "object",
            "title": "Accommodations",
            "properties": {
                "camp_preference": {
                    "type": "string",
                    "title": "Camp Preference",
                    "enum": ["Camp 1", "Camp 2", "Camp 3"],
                    "default": "Camp 1"
                },
                "accommodation_preference": {
                    "type": "string",
                    "title": "Accommodation Preference",
                    "enum": ["Cabin", "Tent", "Vehicle Camping"]
                }
            },
            "required": ["camp_preference", "accommodation_preference"],
            "dependencies": {
                "accommodation_preference": {
                    "oneOf": [
                        {
                            "properties": {
                                "accommodation_preference": {
                                    "enum": ["Cabin"]
                                },
                                "cabinmates": {
                                    "type": "array",
                                    "title": "Who would you like to share a cabin with?",
                                    "maxItems": 4,
                                    "items": {
                                        "type": "string",
                                        "maxLength": 50,
                                        "title": "Camper Name"
                                    }
                                }
                            }
                        },
                        {
                            "properties": {
                                "accommodation_preference": {
                                    "enum": ["Tent"]
                                },
                                "tent_or_vehicle_mates": {
                                    "type": "array",
                                    "title": "Are you sharing your tent with anyone? If so, add their names below.",
                                    "maxItems": 4,
                                    "items": {
                                        "type": "string",
                                        "maxLength": 50,
                                        "title": "Name"
                                    }
                                },
                                "tenting_area_preference": {
                                    "type": "object",
                                    "title": "What are your tent area preferences, in order?",
                                    "properties": {
                                        "first_choice": {
                                            "$ref": "#/definitions/camping_preference",
                                            "title": "First choice spot"
                                        },
                                        "second_choice": {
                                            "$ref": "#/definitions/camping_preference",
                                            "title": "Second choice spot"
                                        },
                                        "third_choice": {
                                            "$ref": "#/definitions/camping_preference",
                                            "title": "Third choice spot"
                                        },
                                        "fourth_choice": {
                                            "$ref": "#/definitions/camping_preference",
                                            "title": "Fourth choice spot"
                                        }
                                    },
                                    "required": ["first_choice", "second_choice", "third_choice", "fourth_choice"]
                                }
                            }
                        },
                        {
                            "properties": {
                                "accommodation_preference": {
                                    "enum": ["Vehicle Camping"]
                                },
                                "tent_or_vehicle_mates": {
                                    "title": "Are you sharing your vehicle camping with anyone? If so, add their names below.",
                                    "type": "array",
                                    "items": {
                                        "type": "string",
                                        "maxLength": 50,
                                        "title": "Name"
                                    }
                                },
                                "vehicle_make": {
                                    "title": "What is the make/model of your camping vehicle?",
                                    "type": "string",
                                    "maxLength": 50
                                },
                                "vehicle_length": {
                                    "title": "How many linear feet is your vehicle?",
                                    "type": "integer",
                                    "minimum": 10,
                                    "maximum": 25,
                                    "default": 15
                                }
                            }
                        }
                    ]
                }
            }
        },
        "meals": {
            "type": "object",
            "title": "Meal Plans",
            "properties": {
                "meal_plan": {
                    "type": "string",
                    "title": "What meals will you purchase?",
                    "enumNames": [
                        "None",
                        "Full Camp, All Meals",
                        "Full Camp, Just Dinners",
                        "Half Camp (first half), All Meals",
                        "Half Camp (second half), All Meals"
                    ],
                    "enum": [
                        "",
                        "F",
                        "D",
                        "A",
                        "B"
                    ],
                    "default": ""
                }
            },
            "dependencies": {
                "meal_plan": {
                    "oneOf": [
                        {
                            "properties": {
                                "meal_plan": {
                                    "enum": [""]
                                }
                            }
                        },
                        {
                            "properties": {
                                "meal_plan": {
                                    "enum": [
                                        "F",
                                        "D",
                                        "A",
                                        "B"
                                    ]
                                },
                                "meal_type": {
                                    "type": "string",
                                    "title": "What types of meals do you want?",
                                    "enumNames": [
                                        "Non-Vegetarian",
                                        "Vegetarian",
                                        "Vegan"
                                    ],
                                    "enum": [
                                        "O",
                                        "V",
                                        "E"
                                    ]
                                }
                            }
                        }
                    ]
                }
            }
        }
    },
    "required": [
        "campers", "tshirt_sizes", "sweatshirt_sizes", "payment",
    ],
    "properties": {
        "payment": {
            "type": "object",
            "required": [
                "payer_first_name", "payer_last_name", "payer_number",
                "payment_type", "payment_full_or_deposit",
            ],
            "properties": {
                "payer_first_name": {
                    "type": "string",
                    "maxLength": 50,
                    "title": "Billing First Name"
                },
                "payer_last_name": {
                    "type": "string",
                    "maxLength": 50,
                    "title": "Billing Last Name"
                },
                "payer_billing_address": {
                    "$ref": "#/definitions/address"
                },
                "payer_number": {
                    "type": "string",
                    "maxLength": 20,
                    "pattern": "^\\+[0-9]+$",
                    "title": "Phone Number"
                },
                "payment_type": {
                    "type": "string",
                    "title": "Payment Type",
                    "enum": [
                        "check",
                        "credit_card",
                        "paypal",
                    ],
                    "enumNames": [
                        "Check (personal check, bank check or money order)",
                        "Credit card",
                        "PayPal",
                    ],
                    "default": "check",
                },
                "payment_full_or_deposit": {
                    "type": "string",
                    "title": "Full Payment or Deposit Only",
                    "enum": [
                        "full",
                        "deposit"
                    ],
                    "enumNames": [
                        "Full Payment",
                        "50% Deposit"
                    ],
                    "default": "full"
                },
            },
            "dependencies": {
                "payment_type": {
                    "oneOf": [
                        {
                            "properties": {
                                "payment_type": {
                                    "enum": ["", "check", "credit_card"]
                                }
                            },
                        },
                        {
                            "properties": {
                                "payment_type": {
                                    "enum": ["paypal"]
                                },
                                "paypal_email": {
                                    "type": "string",
                                    "format": "email",
                                    "title": "PayPal Email"
                                },
                            },
                            "required": ["paypal_email"]

                        }
                    ]
                },
            },
        },
        "parking_passes": {
            "type": "array",
            "title": "Parking Passes",
            "minItems": 0,
            "maxItems": 4,
            "items": {
                "type": "object",
                "title": "Parking Pass",
                "properties": {
                    "holder": {
                        "type": "string",
                        "maxLength": 50,
                        "title": "Whose name will the parking pass be in?"
                    }
                },
                "required": ["holder"]
            }
        },
        "tshirt_sizes": {
            "$ref": "#/definitions/sizes",
            "title": "T-shirt Sizes"
        },
        "sweatshirt_sizes": {
            "$ref": "#/definitions/sizes",
            "title": "Sweatshirt Sizes"
        },
        "lta_donation": {
            "type": "integer",
            "minimum": 0,
            "title": "Donation to Lark Traditional Arts (Tax Deductible, Dollars)"
        },
        "how_did_you_hear": {
            "type": "string",
            "maxLength": 50,
            "title": "How did you hear about Lark Camp?"
        },
        "comments": {
            "type": "string",
            "maxLength": 500,
            "title": "Comments"
        }
    }
};
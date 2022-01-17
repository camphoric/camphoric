export default {
    "title": "Lark Camp 2022 Registration",
    "description": `
Please read [Terms of Registration](http://www.larkcamp.org/campterms.html) before filling out this form.

Fill out this form to register for Lark Camp 2022 online.  Please note that
registrations are accepted in the order they are received and your camping
preferences are processed on a "first come - first served" basis.

Fields marked with an asterisk (*) are required.

`,
    "type": "object",
    "definitions": {
        "natural": {
            "type": "integer",
            "minimum": 0,
            "default": 0
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
        "meals": {
            "type": "object",
            "title": "Meal Plans",
            "description": `Meal plans must be fully paid {meals_due_date}. We cannot accept partial payments. Food prices include sales tax. 

NOTE: You may only cook if you’re camping in a vehicle with a built-in kitchen. No portable white gas or propane stoves are allowed in the park.

**Meal Plan Pricing (adult / child 11 and under)**

*   Full camp, full meals \${{pricing.meals_adult_full}} adults / \${{pricing.meals_teen_full}} kids
*   Full camp, just dinners: \${{pricing.meals_adult_dinners}} adults / \${{pricing.meals_teen_dinners}} kids
*   Half camp, full meals: \${{pricing.meals_adult_half}} adults / \${{pricing.meals_teen_half}} kids

Meal plans offer significant savings. You may buy individual meals at camp instead of buying a meal plan. (But it costs more!)`,
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
        "campers", "payment",
    ],
    "properties": {
        "payment": {
            "title": "Payment information",
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
                    "title": "Billing Address",
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
                    "description": "If you're paying by PayPal or credit card, we'll be sending you a confirmation with payment instructions within the next week.",
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
                    "description": `You may pay either your full registration fee or a 50% deposit to reserve your place at camp.

Your 50% deposit is non-refundable.  If you pay the full amount, only 50% is refundable.  Please consider purchasing trip insurance if you know something could prevent your attendance.`,
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
            "description": `The Mendocino Woodlands asks us to carpool when possible to reduce the number of cars in the State Park.

**ALL vehicles and trailers are required to have a parking pass.**  
*Mendocino Woodlands vehicle requirements:* If you have a car AND a trailer, you will need two (2) parking passes. If your vehicle, or combined vehicle and trailer, is over 20 feet long, call to ensure there is available space *before* you register.

*   You can pre-purchase parking passes for \${{pricing.parking_pass}}; you’ll receive your parking pass when you arrive at camp.
*   If you purchase your parking pass at camp, the cost will be \${{pricing.parking_pass_at_camp}} (no credit cards accepted at camp).`,
            "minItems": 0,
            "maxItems": 4,
            "items": {
                "title": "parking pass",
                "type": "object",
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
        "lta_donation": {
            "type": "integer",
            "minimum": 0,
            "title": "Donation to Lark Traditional Arts (Tax Deductible, Dollars)",
            "description": `Lark Traditional Arts (EIN 83-2424940) is the nonprofit organization that runs Lark Camp. If you would like to support camp with a tax-deductible donation in addition to your registration today, please use the space below to add the amount. Or you may go to: [https://www.larkcamp.org/](https://www.larkcamp.org/)`,
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

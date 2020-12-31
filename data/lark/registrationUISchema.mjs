export default {
    "ui:description": { "__html": "<p>Please read <a href='http://www.larkcamp.org/campterms.html' target='_blank'>Terms of Registration</a> before filling out this form.</p><p>Fill out this form to complete your registration for Lark Camp 2020 online. Please note that registrations are accepted in the order they are received; your camping preferences are processed on a “first come - first served” basis. Your early payment will not be cashed or charged until January 2020.</p><p>Fields marked with an asterisk (*) are required.</p><p><strong>There are no refunds</strong>; please consider purchasing trip insurance if you know something could prevent your attendance.</p>" },
    "payment": {
        "ui:title": "Payment information",
        "ui:order": [
            "payer_first_name",
            "payer_last_name",
            "payer_billing_address",
            "payer_number",
            "payment_type",
            "paypal_email",
            "payment_full_or_deposit",
        ],
        "payer_billing_address": {
            "ui:title": "Billing Address",
            "contentClassNames": "row",
            "street_address":       { "classNames": "col-xs-12 col-sm-12" },
            "city":                 { "classNames": "col-xs-12 col-sm-12"  },
            "state_or_province":    { "classNames": "col-xs-6  col-sm-6"  },
            "zip_code":             { "classNames": "col-xs-6  col-sm-6"  },
            "country":              { "classNames": "col-xs-12 col-sm-6"  }
        },
        "payer_number": {
            "ui:widget": "PhoneInput"
        },
        "payment_type": {
            "ui:description": { "__html": `<p>A per camper discount will be automatically applied if paying 
            by check - <span class=\"pricing_check_discount_full\"></span> for full camp, 
            <span class=\"pricing_check_discount_half\"></span> for half camp. If you're paying by PayPal or 
            credit card, we'll be sending you a confirmation with payment instructions within the next week.</p>` }
        },
        "payment_full_or_deposit": {
            "ui:description": { "__html": "<p>Full Payment - Pay your full registration now</p><p>Deposit 50% Tuition - Reserve your space with a deposit, due June 20th.</p>" }
        },
    },
    "parking_passes": {
        "ui:description": { "__html": "<p>The Mendocino Woodlands asks us to carpool when possible to reduce the number of cars in the State Park. <a href='https://www.larkcamp.org/carpool.html' target='_blank'>Go to larkcamp.org to find out about sharing rides.</a></p><p><strong>ALL vehicles and trailers are required to have a parking pass.</strong><br><u>Mendocino Woodlands vehicle requirements:</u> If you have a car AND a trailer, you will need two (2) parking passes. If your vehicle, or combined vehicle and trailer, is over 20 feet long, call to ensure there is available space <u>before</u> you register.</p><ul><li>You can pre-purchase parking passes for <span class=\"pricing_parking_pass\"></span>; you’ll receive your parking pass when you arrive at camp.</li><li>If you purchase your parking pass at camp, the cost will be <span class=\"pricing_parking_pass_at_camp\"></span> (note: NO credit cards accepted at that time).</li></ul>" }
    },
    "campers": {
        "ui:title": "Camper Information",
        "ui:description": "There is a big blue button below to add additional campers.  You may add up to 6 additional campers",
        "ui:options": {
            "orderable": false
        },
        "items": {
            "session": {
                "ui:description": { "__html": "<p><u>Full camp</u> begins Friday, July 31, 2020 at 3:00 pm, and ends Saturday, August 8 at 9:00am.<br><u>First half camp</u> begins Friday, July 31, 2020 at 3:00 pm and ends before noon on Tuesday, August 4.<br><u>Second half camp</u> begins at noon on Tuesday, August 4, 2020 and ends August 8 at 9:00 am.</p><p>A discount of <span class=\"pricing_check_discount_full\"></span> (<span class=\"pricing_check_discount_half\"></span> for half camp) is given if you are paying by check.</p><ul><li>Full camp (adult): <span class=\"pricing_full_adult\"></span></li><li>Full camp (11 and under): <span class=\"pricing_full_teen\"></span></li><li>Half camp (adult): <span class=\"pricing_half_adult\"></span></li><li>Half camp (11 and under): <span class=\"pricing_half_teen\"></span></li></ul>" }
            },

            "camper_address": {
                "ui:title": "Address",
                "contentClassNames": "row",
                "street_address":       { "classNames": "col-xs-12 col-sm-12" },
                "city":                 { "classNames": "col-xs-12 col-sm-12"  },
                "state_or_province":    { "classNames": "col-xs-6  col-sm-6"  },
                "zip_code":             { "classNames": "col-xs-6  col-sm-6"  },
                "country":              { "classNames": "col-xs-12 col-sm-6"  }
            },
            "accommodations": {
                "classNames": "accommodations",
                "cabinmates": {
                    "ui:description": "Let us know and we will try to accommodate your request."
                },
                "tenting_area_preference": {
                    "ui:description": { "__html": "<p>Fill in your tenting preference below. To see a map of camp click on the links to open another window. Area A-C are in <a href='https://www.larkcamp.org/wp-content/uploads/2020/01/camp1-1024x775.gif' target='_blank'>Camp One</a>, D-H are in <a href='https://www.larkcamp.org/wp-content/uploads/2020/01/camp2-1024x735.gif' target='_blank'>Camp Two</a>, I-L are in <a href='https://www.larkcamp.org/wp-content/uploads/2020/01/camp3-1024x747.gif' target='_blank'>Camp Three</a></p>" }
                }
            },
            "meals": {
                "ui:description": { "__html": "<p>Meal plans must be paid in full (we cannot accept partial payments) NO LATER THAN JUNE 20, 2020. Food prices include sales tax. You may buy individual meals (at a higher rate!) at camp if you would prefer not to purchase a full meal plan. (NOTE: You may only cook if you have a vehicle with a built-in kitchen. No white gas or propane stoves are allowed in the State Park.)</p><p>This is a significant savings over buying meals at camp.  Full meals includes breakfast, lunch, and dinner.</p><p><strong>Meal Plan Pricing (adult / child 11 and under)</strong></p><ul><li>Full camp, full meals <span class=\"pricing_meals_adult_full\"></span> adults / <span class=\"pricing_meals_teen_full\"></span> kids</li><li>Full camp, just dinners: <span class=\"pricing_meals_adult_dinners\"></span> adults / <span class=\"pricing_meals_teen_dinners\"></span> kids</li><li>Half camp, full meals: <span class=\"pricing_meals_adult_half\"></span> adults / <span class=\"pricing_meals_teen_half\"></span> kids</li> </ul>" }
            }
        }
    },
    "comments": {
        "ui:widget": "textarea",
        "ui:options": {
          "rows": 5
        }
    },
    "tshirt_sizes": {
        "contentClassNames": "row",
        "small":  { "classNames": "col-xs-4 col-sm-2", "ui:widget": "NaturalNumberInput"},
        "medium": { "classNames": "col-xs-4 col-sm-2", "ui:widget": "NaturalNumberInput" },
        "large":  { "classNames": "col-xs-4 col-sm-2", "ui:widget": "NaturalNumberInput" },
        "xl":     { "classNames": "col-xs-4 col-sm-2", "ui:widget": "NaturalNumberInput" },
        "xxl":    { "classNames": "col-xs-4 col-sm-2", "ui:widget": "NaturalNumberInput" },
        "ui:description": { "__html": "<p>All sizes <span class=\"pricing_tshirt\"></span>. Price includes sales tax.<br><a href='https://www.larkcamp.org/shirt.html' target='_blank'>More Information About Lark Camp Shirts</a></p><p>T-shirts are straight cut by default; if you want a fitted cut t-shirt, let us know in the comments box below. </p><p>We use the language “Straight Cut”, and “Fitted Cut” for the two different scales called Unisex/Men’s and Women’s by the garment industry.</p><p>Fitted cut garments are typically 1 size smaller than the equivalent straight cut. For example if you typically wear a large fitted garment you would typically wear a small in straight cut sizing.</p>" }
    },
    "sweatshirt_sizes": {
        "contentClassNames": "row",
        "small":  { "classNames": "col-xs-4 col-sm-2", "ui:widget": "NaturalNumberInput" },
        "medium": { "classNames": "col-xs-4 col-sm-2", "ui:widget": "NaturalNumberInput" },
        "large":  { "classNames": "col-xs-4 col-sm-2", "ui:widget": "NaturalNumberInput" },
        "xl":     { "classNames": "col-xs-4 col-sm-2", "ui:widget": "NaturalNumberInput" },
        "xxl":    { "classNames": "col-xs-4 col-sm-2", "ui:widget": "NaturalNumberInput" },
        "ui:description": { "__html": "<p>All sizes <span class=\"pricing_sweatshirt\"></span>.</p>" }
    },
    "lta_donation": {
        "ui:description": { "__html": "<p><strong>DONATE TO LARK CAMP</strong><br>Lark Traditional Arts (EIN 83-2424940) is the nonprofit organization that runs Lark Camp. If you would like to support camp with a tax-deductible donation in addition to your registration today, please use the space below to add the amount. Or you may go to: <a href='https://www.larkcamp.org/'>https://www.larkcamp.org/</a></p>" }
    },
    "woodlands_donation": {
        "ui:help": "This does not go to Lark Camp but benefits the Mendocino Woodlands",
        "ui:widget": "NaturalNumberInput"
    }
};
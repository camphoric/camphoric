import meals from './camperMeals.js';
import pricing from './pricing/pricing.js';

export const sessionTypes = {
  F: 'Full camp',
  A: 'Half camp - 1st half',
  B: 'Half camp - 2nd half',
};

export default {
  'type': 'object',
  'required': [
    'vaccination_status',
    'first_name',
    'last_name',
    'gender',
    'session',
    'meals'
  ],
  'dependencies': {
    'name_badge': {
      'oneOf': [
        {
          'properties': {
            'name_badge': {
              'enum': [false, ''],
            },
          },
        },
        {
          'properties': {
            'name_badge': {
              'enum': [true],
            },
            'name_badge_name': {
              'type': 'string',
              'maxLength': 50,
              'title': 'Name for name badge'
            },
            'name_badge_gender': {
              'type': 'string',
              'maxLength': 10,
              'title': 'Gender for name badge'
            },
          },
          'required': ['name_badge_name'],
        },
      ],
    },

    'address_different_than_payer': {
      'oneOf': [
        {
          'properties': {
            'address_different_than_payer': {
              'enum': [false, ''],
            },
          },
        },
        {
          'properties': {
            'address_different_than_payer': {
              'enum': [true],
            },
            'camper_address': {
              'title': 'Address',
              '$ref': '#/definitions/address'
            },
          },
          'required': ['camper_address'],
        },
      ],
    },
    'session': {
      'oneOf': [
        {
          'properties': {
            'session': { enum: [sessionTypes.F] },
            'meals': meals('F', 'D'),
          }
        },
        {
          'properties': {
            'session': { enum: [sessionTypes.A]  },
            'meals': meals('A'),
          }
        },
        {
          'properties': {
            'session': { enum: [sessionTypes.B] },
            'meals': meals('B'),
          }
        },
      ],
    }
  },
  'properties': {
    'first_name': {
      'type': 'string',
      'maxLength': 50,
      'title': 'First name'
    },
    'last_name': {
      'type': 'string',
      'maxLength': 50,
      'title': 'Last name'
    },
    'email': {
      'title': 'Camper Email',
      'type': 'string',
      'format': 'email',
    },
    'gender': {
      'type': 'string',
      'title': 'Gender',
      'enum': ['Male', 'Female', 'Non-binary'],
    },
    'age': {
      'type': 'string',
      'title': 'Age (at the beginning of camp)',
      'description': 'In order to help us abide by CDC recommendations, please select your age category at time of camp',
      'enum': [
        '65 years old or older',
        '50-64 years old',
        '26-49 years old',
        '18-25 years old',
        '12-17 years old',
        '5-11 years old',
        '0-4 years old',
      ],
      'default': '65 years old or older',
    },
    'name_badge': {
      'type': 'boolean',
      'title': `I would like to purchase a name badge for $${pricing.name_badge}`,
      'enum': [false, true],
      'enumNames': ['No', 'Yes'],
      'default': false,
    },
    'address_different_than_payer': {
      'type': 'boolean',
      'title': 'This camper\'s address is different than the billing address',
      'enum': [false, true],
      'enumNames': ['No', 'Yes'],
      'default': false,
    },
    'parking_passes': {
      'type': 'array',
      'title': 'Parking Passes',
      'description': `The Mendocino Woodlands asks us to carpool when possible to reduce the number of cars in the State Park.

**ALL vehicles and trailers are required to have a parking pass.**  
*Mendocino Woodlands vehicle requirements:* If you have a car AND a trailer, you will need two (2) parking passes. If your vehicle, or combined vehicle and trailer, is over 20 feet long, call to ensure there is available space *before* you register.

*   You can pre-purchase parking passes for \${{pricing.parking_pass}}; you’ll receive your parking pass when you arrive at camp.
*   If you purchase your parking pass at camp, the cost will be \${{pricing.parking_pass_at_camp}} (no credit cards accepted at camp).`,
      'minItems': 0,
      'maxItems': 4,
      'items': {
        'title': 'parking pass',
        'type': 'object',
        'properties': {
          'vehicle_type': {
            'type': 'string',
            'title': 'Vehicle Type',
            'enum': [
              'Regular car',
							'RV under 15\' long',
              'RV 15\'-20\' long',
            ],
            'default': 'Regular car',
          },
          'pass_type': {
            'type': 'string',
            'title': 'Parking Type',
            'enum': [
              'Long Term',
              'Vehicle Camp 1',
              'Vehicle Camp 2',
              'Vehicle Camp 3',
              'Short Term',
              'Camp 1',
              'Camp 2',
              'Camp 3',
              'Park Anywhere',
            ],
            'default': 'Long Term',
          }
        },
      }
    },

    'session': {
      'type': 'string',
      'title': 'When will you attend?',
      'description': `*Full camp* begins {{full_camp_start_date_time}}, and ends {{full_camp_end_date_time}}.  
*First half camp* begins {{first_half_camp_start_date_time}}, and ends {{first_half_camp_end_date_time}}.  
*Second half camp* begins {{second_half_camp_start_date_time}}, and ends {{second_half_camp_end_date_time}}.  

| Pricing (age range) | adult (18+) | youth (5-17) | kid¹ (0-4) |
| --- | --- | --- | --- |
| Full Camp | \${{pricing.full_adult}} | \${{pricing.full_youth}} | \${{pricing.full_kid}} |
| Half Camp | \${{pricing.half_adult}} | \${{pricing.half_youth}} | \${{pricing.half_kid}} |

1: Children 4 and under are free, but may not take up a cabin bed.`,
      'enum': Object.values(sessionTypes),
      'default': sessionTypes.F,
    },
  }
};

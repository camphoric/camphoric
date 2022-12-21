export default {
  'type': 'object',
  'title': "Welcome to BACDS Family Week's Online Registration!",
  'required': ['address', 'primary_phone', /*'payment_option'*/],
  'properties': {
    'address': {
      'type': 'object',
      'title': 'Address',
      'required': ['street_address', 'city', 'state_or_province', 'zip_code'],
      'properties': {
        'street_address': {
          'type': 'string',
          'maxLength': 50,
          'title': 'Street Address',
        },
        'city': {
          'type': 'string',
          'maxLength': 50,
          'title': 'City'
        },
        'state_or_province': {
          'type': 'string',
          'maxLength': 50,
          'title': 'State or Province',
        },
        'zip_code': {
          'type': 'string',
          'minLength': 3,
          'maxLength': 10,
          'title': 'ZIP Code or Postal Code',
        },
      },
    },
    'primary_phone': {
      'type': 'string',
      'maxLength': 20,
      'pattern': '^\\+[0-9]+$',
      'title': 'Primary Phone Number',
    },
    'secondary_phone': {
      'type': 'string',
      'maxLength': 20,
      'pattern': '^\\+[0-9]+$',
      'title': 'Secondary Phone Number',
    },
    'donation': {
      'type': 'integer',
      'minimum': 0,
      'title': 'Family Week Donation',
      'description': 'We operate at a loss. Please consider rounding up your contribution no make the loss a little less.',
    },
    'ride_share': {
      'type': 'string',
      'enum': ['offer', 'request'],
      'enumNames': [
        'I can offer a ride to camp',
        'I need a ride to camp',
      ],
      'title': 'Ride Sharing',
    },
    'ride_seats_offered': {
      'type': 'integer',
      'minimum': 0,
      'title': 'If you can offer a ride, how many seats do you have available?'
    },
    /*
    'payment_option': {
      'type': 'string',
      'enum': ['pay_all', 'pay_deposit'],
      'enumNames': [
        'Pay my full registration by check',
        'Pay a deposit of $50 per camper by check (balance due by June 1st)',
      ],
      'title': 'Payment Options',
      'description': 'Please choose a payment option. We will provide details on how to pay once you submit your registration.',
    },
    */
  },
};

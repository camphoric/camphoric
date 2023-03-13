const lodgingDescription = `
The Mendocino Woodlands is a WPA-era campground with rustic wooden cabins. Each of the three camps has cabins or tent-cabins and in most cases are shared by four people. All are equipped with cots and mattresses, but no bedding and none have electricity. Each camp has designated tent camping areas for a pre-assigned number of tents. Each camp has limited, designated space for camping vehicles.

[There are three camps](https://www.larkcamp.org/wp-content/uploads/2019/10/About_WoodlandsMap.jpg) divided roughly by the following themes, with busses that run regularly between camps. Each has workshops, sessions, dances, and events related to these themes.

**Camp One**    
[Map of Camp One.](https://www.larkcamp.org/wp-content/uploads/2023/02/Camp-1-LARGE.pdf)
Ireland, British Isles, Greece, Eastern Europe, and Sweden.

**Camp Two**    
[Map of Camp Two.](https://www.larkcamp.org/wp-content/uploads/2023/02/Camp-2-LARGE.pdf)
Latin America, North America, Spain, and France

**Camp Three**    
[Map of Camp Three.](https://www.larkcamp.org/wp-content/uploads/2023/02/Camp-3-LARGE.pdf)
The Middle East, Greece, Asia, and Africa
`;

const address = {
  'ui:field': 'Address',
  'ui:order': [
    'street_address',
    'city',
    'state_or_province',
    'zip_code',
    'country',
  ],
};

export default {
  'ui:order': [
    'registrant_email',
    'payment',
    'campers',
    'parking_passes',
    'lta_donation',
    'how_did_you_hear',
    'comments',
  ],
  'payment': {
    'contentClassNames': 'camphoric-payment',
    'ui:order': [
      'payer_first_name',
      'payer_last_name',
      'payer_billing_address',
      'payer_number',
      'payment_type',
      'paypal_email',
    ],
    'payer_billing_address': address,
    'payer_number': {
      'ui:widget': 'PhoneInput'
    },
  },
  'campers': {
    // For some reason the title and description have to stay in the
    // ui-schema, or their duplicated for each camper
    'ui:title': 'Camper Information',
    'ui:description': 'There is a big blue button below to add additional campers.',
    'ui:field': 'Campers',
    'ui:options': {
      'orderable': false
    },
    'items': {
      'ui:order': [
        'first_name',
        'last_name',
        'address_different_than_payer',
        'camper_address',
        'gender',
        'age',
        'vaccination_status',
        'session',
        'meals',
        'lodging',
        '*',
      ],
      'camper_address': address,
      'meals': {
        'meal_plan': {
          'ui:placeholder': 'Choose an option',
        },
      },
      'lodging': {
        'ui:description': lodgingDescription,
      },
      'vaccination_status': {
        'ui:widget': 'checkboxes'
      },
    },
  },
  'lta_donation': {
    'ui:options':  {
      'prefix': '$',
    },
  },
  'parking_passes': {
    'ui:options':  {
      'addable': true,
      'removable': true,
      'addButtonText': 'Add A Parking Pass',
    },
    items: {
      'ui:title': 'parking pass',
    }
  },
  'comments': {
    'ui:widget': 'textarea',
    'ui:options': {
      'rows': 5
    }
  },
};

export default {
  'ui:order': [
    'registrant_email',
    'payment_type',
    'paypal_email',
    'campers',
    'lta_donation',
    'how_did_you_hear',
    'comments',
  ],
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
        'gender',
        'age',
        'email',
        'phone',
        'vaccination_status',
        'lodging',
        '*',
      ],
      'phone': {
        'ui:widget': 'PhoneInput'
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
  'comments': {
    'ui:widget': 'textarea',
    'ui:options': {
      'rows': 5
    }
  },
};

// How the registration form lays out (an rjsf uiSchema)
export default {
  'ui:order': ['registrant_email', 'campers', 'address', 'how_heard', 'donation', 'comments'],
  campers: {
    'ui:title': 'Campers',
    'ui:description': 'Add everyone in your household who is coming.',
    'ui:field': 'Campers',
    'ui:options': { orderable: false },
    items: {
      'ui:order': ['first_name', 'last_name', 'age', 'email', 'phone', 'arrival', 'lodging', 'diet', 't_shirt', '*'],
      phone: { 'ui:widget': 'PhoneInput' },
      diet: { 'ui:widget': 'checkboxes' },
      age: { 'ui:placeholder': 'Choose an age group' },
    },
  },
  how_heard: { 'ui:widget': 'radio' },
  donation: { 'ui:options': { prefix: '$' } },
  comments: { 'ui:widget': 'textarea', 'ui:options': { rows: 4 } },
};

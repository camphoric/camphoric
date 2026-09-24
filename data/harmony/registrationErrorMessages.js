/**
 * Custom validation messages for the registration form, keyed by field path
 * (array indexes written as "*") and then by validation keyword. Messages are
 * Handlebars templates; see SPEC_CLIENT_V2.md §7.1 for the placeholders
 * ({{camper}}, {{field}}, …).
 */
export default {
  'campers.*.lodging.lodging_requested.id': {
    required: '{{camper}}: please finish choosing your lodging',
  },
};

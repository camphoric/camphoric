/**
 * Custom validation messages for the registration form, by field path (array
 * indexes written as "*") and validation keyword. They are Handlebars; see
 * SPEC_CLIENT_V2.md §7.1 for the placeholders ({{camper}}, {{field}}, …).
 * The path "*" holds the event-wide default for a keyword.
 */
export default {
  'campers.*.lodging.lodging_requested.id': {
    required: '{{camper}}: please finish choosing where you will stay',
  },
  'campers.*.phone': {
    pattern: '{{camper}}: enter the phone number with its country code, like +15555550123',
  },
  '*': {
    required: '{{field}} is required',
  },
};

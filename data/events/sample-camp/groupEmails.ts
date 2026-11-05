import type { GroupEmail } from '@camphoric/camphoric-event-import-spec';

import { year } from './dates.ts';

// Group emails (SPEC §8.9) are Jinja. One to registrations (`registration`,
// `campers`, `event`, `recipient`) chosen by a rule; one to campers
// (`camper`, `registration`, `event`, `recipient`), chosen by a rule and an
// expression, with their own address and name; one to a list of addresses
// (`recipient`, `event`).
export default [
  {
    name: 'Balance reminder',
    subject: 'A balance is due for {{ event.name }}',
    body: `
Hello,

Your registration for {{ event.name }} has a balance of
{{ registration.balance | money }}. Thank you for paying it before camp.

The Sample Camp team
`,
    recipient_source: 'registrations',
    filter: { rules: [{ field: 'registration.balance', op: 'gt', value: 0 }] },
  },
  {
    name: 'T-shirt pickup',
    subject: 'Your {{ event.name }} T-shirt',
    body: `
Hello {{ recipient.name }},

Your {{ camper.attributes.t_shirt.size }} camp T-shirt is ready. Pick it up at
the welcome table when you arrive.

The Sample Camp team
`,
    from_email: 'registrar@example.com',
    reply_to: 'questions@example.com',
    recipient_source: 'campers',
    // Campers who ordered a shirt...
    filter: {
      combinator: 'and',
      rules: [{ field: 'camper.attributes.t_shirt.wanted', op: 'is_true' }],
    },
    // ...on a registration that's paid up
    filter_expression: 'registration.balance <= 0',
    address_expression: 'camper.attributes.email or registration.registrant_email',
    name_expression: 'camper.attributes.first_name',
    include_incomplete: false,
  },
  {
    name: 'Volunteer call',
    subject: `Volunteering at Sample Camp ${year}`,
    body: `
Hello {{ recipient.name or recipient.email }},

We're looking for help setting up {{ event.name }}. Reply to this email if
you can lend a hand.
`,
    from_email: 'volunteers@example.com',
    reply_to: 'volunteers@example.com',
    recipient_source: 'manual',
    recipient_list: 'Pat Example <pat@example.com>\nlee@example.com',
  },
] satisfies GroupEmail[];

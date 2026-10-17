import { year } from './dates.ts';

// Jinja (SPEC §8.3): `campers`, `registration`, `pricing`, `invoice` and
// `event` are the server's template variables.
export const confirmation_email_subject = `Sample Camp ${year}: you're registered`;

export const confirmation_email_template = `
Hello {{ campers[0].attributes.first_name }},

Thank you for registering for Sample Camp ${year}. You registered:

{% for camper in campers -%}
- {{ camper.attributes.first_name }} {{ camper.attributes.last_name }} ({{ camper.attributes.age }}),
  staying in {{ camper.lodging.name if camper.lodging else 'lodging to be assigned' }}: {{ camper.pricing.total | money }}
{% endfor %}
Total: {{ registration.total_owed | money }}
Balance: {{ registration.balance | money }}

The Sample Camp team
`;

export const confirmation_email_from = 'registrar@example.com';

import { year } from './dates.js'

const subject = `Jughandle Campout ${year} Registration Confirmation`;
// Jinja (SPEC §8.3): `campers`, `registration`, `pricing`, `initial_payment` and
// `event` are the server's template variables. `{%-` swallows the tag's line,
// as Mustache did for a tag alone on its line.
const template = `
Dear {{ campers[0].attributes.first_name }} {{ campers[0].attributes.last_name }},

Your online registration for the Jughandle Campout ${year} has been received.

You have registered the following campers:

{% for camper in campers -%}
- {{ camper.attributes.first_name }} {{ camper.attributes.last_name }}
  - {{ camper.attributes.age }}
  - Chore: {{ camper.attributes.chore }}
  - Lodging: {{ camper.lodging.name if camper.lodging else 'none' }}
  - {{ camper.pricing.total | money }}
{% endfor %}
{% if pricing.singledaycount -%}
You chose *Lodging Off site - Single Day*.  You may attend on either Saturday or Sunday. When you arrive please check in at the registration table or with the on-call registration person and you will receive a single day wristband.
{% endif %}
Donation to Lark Traditional Arts - {{ pricing.donation | money }}

TOTAL DUE: {{ pricing.total | money }}

You chose to pay by {{ registration.payment_type }}

If you're paying by check, please make it for {{ pricing.total | money }} payable to "Lark Traditional Arts", and mail it to:

Lark Traditional Arts    
PO Box 1724    
Mendocino, CA 95460    
USA    

Do you have questions? Email us at registration@larkcamp.org or call 707-397-5275

Registration Number: ${year}JC{{ registration.id }}
`;

export const confirmation_email_template = template;
export const confirmation_email_subject = subject;

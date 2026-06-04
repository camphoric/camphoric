import { year } from './dates.js'

const subject = `Jughandle Campout ${year} Registration Confirmation`;
const template = `
Dear {{campers.0.first_name}} {{campers.0.last_name}},

Your online registration for the Jughandle Campout ${year} has been received.

You have registered the following campers:

{{#campers}}
- {{first_name}} {{last_name}}
  - {{age}}
  - Chore: {{chore}}
  - Lodging: {{ lodging }}
  - \${{pricing_result.total}}
{{/campers}}

{{#pricing_results.singledaycount}}    
You chose *Lodging Off site - Single Day*.  You may attend on either Saturday or Sunday. When you arrive please check in at the registration table or with the on-call registration person and you will receive a single day wristband.
{{/pricing_results.singledaycount}}    

Donation to Lark Traditional Arts - \${{ pricing_results.donation }}

TOTAL DUE: \${{pricing_results.total}}

You chose to pay by {{registration.payment_type}}

If you're paying by check, please make it for \${{pricing_results.total}} payable to "Lark Traditional Arts", and mail it to:

Lark Traditional Arts    
PO Box 1724    
Mendocino, CA 95460    
USA    

Do you have questions? Email us at registration@larkcamp.org or call 707-397-5275

Registration Number: ${year}JC{{ registration.id }}
`;

export const confirmation_email_template = template;
export const confirmation_email_subject = subject;

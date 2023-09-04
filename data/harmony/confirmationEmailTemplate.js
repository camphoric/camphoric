import { yearDisplay } from './dates.js';

const subject = `Camp Harmony ${yearDisplay} Registration Confirmation`;
const template = `
Dear {{campers.0.first_name}} {{campers.0.last_name}},

Thank you for your online registration for Camp Harmony ${yearDisplay}! This email confirms the following:

You have registered the following campers:

{{#campers}}
- {{first_name}} {{last_name}}
  - {{age}}
  - Chore: {{chore}}
  - Lodging: {{ lodging }}
  - \${{pricing_result.total}}
{{/campers}}

Donation to Lark Traditional Arts - \${{ pricing_results.donation }}

TOTAL DUE: \${{pricing_results.total}}

You chose to pay by {{registration.payment_type}}

If you're paying by check, please make it for \${{pricing_results.total}} payable to "Lark Traditional Arts", and mail it to:

Lark Traditional Arts    
PO Box 1724    
Mendocino, CA 95460    
USA    

Do you have questions? Email us at registration@larkcamp.org or call 707-397-5275

Registration Number: ${yearDisplay}CH{{ registration.id }}
`;

export const confirmation_email_template = template;
export const confirmation_email_subject = subject;

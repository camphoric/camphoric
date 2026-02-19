import { year } from './dates.js';

const subject = `Lark Camp ${year} Registration Confirmation`;
const template = `
Dear {{registration.attributes.payment.payer_first_name}} {{registration.attributes.payment.payer_last_name}},

We’ve received your online registration for Lark Camp ${year}. Please remember
that lodging choices are first come – first served. We will do our best to
accommodate your choice. 

- If you are paying by check, mail checks payable to Lark Camp to: PO Box 1724,
  Mendocino, CA 95460. Be sure to include the first and last name of the person
  who submitted the registration! We will send you a receipt via email.
- We must receive your payment within two weeks of your registration
  submission, or your registration will be canceled. We will send you a receipt
  via email.
- If you paid 50% of your tuition, your final payment will be due NO LATER THAN
  JUNE 20. 
- If you have not yet ordered meals then they also need to be ordered before
  June 20th by emailing registration@larkcamp.org..

**YOU HAVE REGISTERED FOR:**

{{#campers}}
{{first_name}} {{last_name}} - {{session}}    
{{lodging_full}}    
{{meals.meal_plan}}, {{meals.meal_type}}: \${{pricing_result.meals}}    
{{#name_badge.purchase}}
Name badge (\${{pricing_result.name_badge}}): {{name_badge.name}} - {{name_badge.pronouns}}     
{{/name_badge.purchase}}
Parking Passes Total: \${{pricing_result.parking}}    
{{#parking_passes}}
- {{first_name}} {{last_name}}: {{vehicle_type}}    
{{/parking_passes}}

{{#pricing_result.tuition}}
Tuition: \${{pricing_result.tuition}}    
{{/pricing_result.tuition}}
{{#pricing_result.enrollment_fee}}
Enrollment Fee: \${{pricing_result.enrollment_fee}}    
{{/pricing_result.enrollment_fee}}
#########    
{{/campers}}

Donation to Lark Traditional Arts: \${{pricing_results.donation}}    

{{^pricing_results.parking_pass_count}}    
You have not purchased a parking pass, be warned that it will cost a lot more
if you need to purchase one at camp.  If you meant to purchase a parking pass,
please contact the registrar to have it added to your registration.
{{/pricing_results.parking_pass_count}}    

Payment info:

- Initial Payment: {{initial_payment.type}}
- **Amount you are paying now: \${{initial_payment.total}}**
- Due by June 20th: \${{initial_payment.balance}}
- Your total: \${{pricing_results.total}}


Registration Number: ${year}-{{ registration.id }}
`;

export const confirmation_email_template = template;
export const confirmation_email_subject = subject;

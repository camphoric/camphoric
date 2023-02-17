import { year } from './dates.js';

const subject = `Lark Camp ${year} Registration Confirmation`;
const template = `
Dear {{registration.attributes.payment.payer_first_name}} {{registration.attributes.payment.payer_last_name}},

We’ve received your online registration for Lark Camp 2022. This is an
acknowledgement of your online registration. Please remember that lodging
choices are first come – first served. We will do our best to accommodate your
choice. 

- If you are paying by check, mail checks payable to Lark Camp to: PO Box 1724,
  Mendocino, CA 95460. Be sure to include the first and last name of the person
  who submitted the registration! We will send you a receipt via email.
- We must receive your payment within two weeks of your registration
  submission, or your registration will be canceled. We will send you a receipt
  via email.
- If you paid 50% of your tuition, your final payment will be due NO LATER THAN
  JUNE 20. 
- If you have not yet paid for your meals that amount is also due NO LATER THAN
  JUNE 20. Look for instructions in future emails to add a meal plan to your
  registration.

**YOU HAVE REGISTERED FOR:**

{{#campers}}
{{first_name}} {{last_name}} - {{session}}    
{{lodging_full}}    
Tuition \${{pricing_result.tuition}} - {{meals.meal_plan}} \${{pricing_result.meals}}    

{{/campers}}

Donation to Lark Camp - \${{pricing_results.donation}}    

Parking Passes Purchased: \${{pricing_results.parking}}    
{{#registration.attributes.parking_passes}}
- {{holder}}
{{/registration.attributes.parking_passes}}
{{^registration.attributes.parking_passes}}
None
{{/registration.attributes.parking_passes}}

**Your total: \${{pricing_results.total}}**

Registration Number: ${year}-{{ registration.id }}
`;

export const confirmation_email_template = template;
export const confirmation_email_subject = subject;

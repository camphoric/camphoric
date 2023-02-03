import { year } from './dates.js';

const subject = `Lark Camp ${year} Registration Confirmation`;
const template = `
Dear {{registration.payment.payer_first_name}} {{registration.payment.payer_last_name}},

Your online registration for Lark Camp ${year} has been received.

You have registered for:


| Name | Age | Session | Tuition | Meals | Total |
| ---- | --- | ------- | ------- | ----- | ----- |
{{#campers}}
| {{first_name}} {{last_name}} | {{age}} | {{session}} | \${{pricing_result.tuition}} | \${{pricing_result.meals}} ({{meals.meal_plan}}) | \${{pricing_result.total}} |
{{/campers}}

Donation to Lark Camp - \${{pricing_results.donation}}

Parking Passes Purchased: \${{pricing_results.parking}}
{{#registration.parking_passes}}
- {{holder}}
{{/registration.parking_passes}}
{{^registration.parking_passes}}
None
{{/registration.parking_passes}}

TOTAL DUE: \${{pricing_results.total}}

Registration Number: ${year}-{{ registration.id }}
`;

export const confirmation_email_template = template;
export const confirmation_email_subject = subject;

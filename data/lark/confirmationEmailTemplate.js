const subject = 'Lark Camp 2022 Registration Confirmation';
const template = `
Dear {{registration.payment.payer_first_name}} {{registration.payment.payer_last_name}},

Your online registration for Lark Camp 2022 has been received.

You have registered for:


| Name | Age | Session | Tuition | Meals | Total |
| ---- | --- | ------- | ------- | ----- | ----- |
{{#campers}}
| {{first_name}} {{last_name}} | {{age}} | {{session}} | \${{pricing_result.tuition}} | \${{pricing_result.meals}} ({{meals.meal_plan}}) | \${{pricing_result.total}} |
{{/campers}}

Donation to Lark Camp - None Yet
Parking Pass Purchase - None Yet

TOTAL DUE: \${{pricing_results.total}}

Registration Number: 2022-{{ registration.id }}
`;

export default {
  confirmation_email_template: template,
  confirmation_email_subject: subject,
};

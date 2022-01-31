export default `
Lark Camp 2022 Registration Confirmation

Dear {{registration.payment.payer_first_name}} {{registration.payment.payer_last_name}},

Your online registration for Lark Camp 2020 has been received. This is an acknowledgement of your online registration.

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

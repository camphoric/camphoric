export default `
Lark Camp 2022 Registration Confirmation

Dear {{registration.payment.payer_first_name}} {{registration.payment.payer_last_name}},

Your online registration for Lark Camp 2020 has been received. This is an acknowledgement of your online registration.

You have registered for:


| Name | Duration | Tuition | Meals | Total |
| ---- | -------- | ------- | ----- | ----- |
{{#campers}}
| {{first_name}} {{last_name}} | {{session}} | {{pricing_result.tuition}} | {{pricing_result.meals}} ({{meals.meal_plan}}) | {{pricing_result.total}} |
{{/campers}}


Name - Full/Half Camp

50% Tuition $395 - Full Meals $405

Donation to Lark Camp - None Yet

Parking Pass Purchase $65



TOTAL DUE: \${{pricing_results.total}}

Invoice Number: 108698



We will send a separate e-mail with instructions for completing payment via PayPal.



We try to fulfill everyone's first choice of lodging whenever possible.



Thank you for sending in your registration for Lark Camp.


etc.
`;

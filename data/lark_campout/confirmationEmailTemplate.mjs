const subject = 'Lark Campout 2022 Registration Confirmation';
const template = `
Dear {{registration.payment.payer_first_name}} {{registration.payment.payer_last_name}},
Your online registration for the Lark Campout 2022 has been received.
You have registered for:
| Name | Age | Tuition | Total |
| ---- | --- | ------- | ----- |
{{#campers}}
| {{first_name}} {{last_name}} | {{age}} | \${{pricing_result.tuition}} | \${{pricing_result.total}} |
{{/campers}}

Donation to Lark Traditional Arts - None Yet

TOTAL DUE: \${{pricing_results.total}}
Registration Number: 2022-{{ registration.id }}

You chose to pay by {{registration.payment_type}}

If you're paying by check, please make it for \${{pricing_results.total}} payable to "Lark Traditional Arts", and mail it to:

Lark Traditional Arts
PO Box 1724
Mendocino, CA 95460
USA

Do you have questions? Email us at registration@larkcamp.org or call 707-397-5275
`;

export default {
  confirmation_email_template: template,
  confirmation_email_subject: subject,
};

import { year } from './dates.js'

// Jinja markdown, rendered on the server when registration completes (SPEC §7.3):
// `registration`, `campers`, `pricing`, `invoice` and `event`.

export default `
# You're all set!

## See you at Lark Camp ${year}!

{% if invoice and invoice.amount_due -%}
{% if invoice.payment_type in ['PayPal', 'Card'] -%}
Your online payment hasn't gone through, so **{{ invoice.amount_due | money }}** is still due.
You can pay by check instead: make it out
{%- else -%}
Please make your check out
{%- endif %} for **{{ invoice.amount_due | money }}**
payable to "Lark Camp", and mail it to:

Lark Camp  
PO Box 1724  
Mendocino, CA 95460  
USA
{% elif invoice -%}
Thanks for paying electronically, please check your email for your receipt. If there were any
problems with your payment, the registrar will be in touch.
{% endif %}


Do you need approval for your vehicle or trailer, have questions about
carpooling, payments, meals, ordering t-shirts, or anything else? Email us at
[registration@larkcamp.org](mailto:registration@larkcamp.org) or call
[707-397-5275](tel:707-397-5275)

[Visit our website at www.larkcamp.org for more information!](https://www.larkcamp.org)
`;

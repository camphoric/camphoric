import { year } from './dates.ts';

// The email a registrar sends with an invoice: Jinja (SPEC §9.7), with
// `invoice` (id, description, memo, amount_due, due_on, pay_url),
// `registration`, `campers` and `event`.
export const invoice_email_subject = `Sample Camp ${year}: invoice #{{ invoice.id }}`;

export const invoice_email_template = `
Hello,

{% if invoice.memo %}{{ invoice.memo }}

{% endif -%}
Here is your invoice for {{ event.name }}:

**{{ invoice.description or 'Registration' }}: {{ invoice.amount_due | money }} due**
{%- if invoice.due_on %} by {{ invoice.due_on | date('%B %-d, %Y') }}{% endif %}

[Pay online]({{ invoice.pay_url }})

The Sample Camp team
`;

export const invoice_email_from = 'treasurer@example.com';

export const invoice_email_reply_to = 'treasurer@example.com';

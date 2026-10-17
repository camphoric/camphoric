import { year } from './dates.ts';

// Jinja markdown, rendered on the server when registration completes (SPEC §7.3):
// `registration`, `campers`, `pricing`, `invoice` and `event`.
export default `
# You're registered!

## See you at Sample Camp ${year}

{% if invoice and invoice.amount_due -%}
Your balance is **{{ invoice.amount_due | money }}**.
{%- endif %}

Questions? Email registrar@example.com.
`;

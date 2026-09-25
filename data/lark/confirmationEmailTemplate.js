import { year } from './dates.js';

const subject = `Lark Camp ${year} Registration Confirmation`;
// Jinja (SPEC §8.3): `campers`, `registration`, `pricing`, `initial_payment` and
// `event` are the server's template variables. `{%-` / `-%}` swallow a tag's
// line, as Mustache did for a tag alone on its line; `-%}` is used after lines
// ending in a markdown line break (trailing spaces), which `{%-` would eat.
const template = `
{%- set payer = registration.attributes.payment or {} %}
Dear {{ payer.payer_first_name }} {{ payer.payer_last_name }},

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

{% for camper in campers -%}
{%- set meals = camper.attributes.meals or {} -%}
{%- set badge = camper.attributes.name_badge or {} -%}
{{ camper.attributes.first_name }} {{ camper.attributes.last_name }} - {{ camper.attributes.session }}    
{{ camper.lodging.path_names | join(', ') if camper.lodging else 'none' }}    
{{ meals.meal_plan }}, {{ meals.meal_type }}: {{ camper.pricing.meals | money }}    
{% if badge.purchase -%}
Name badge ({{ camper.pricing.name_badge | money }}): {{ badge.name }} - {{ badge.pronouns }}     
{% endif -%}
Parking Passes Total: {{ camper.pricing.parking | money }}    
{% for pass in camper.attributes.parking_passes or [] -%}
- {{ pass.first_name }} {{ pass.last_name }}: {{ pass.vehicle_type }}    
{% endfor %}
{% if camper.pricing.tuition -%}
Tuition: {{ camper.pricing.tuition | money }}    
{% endif -%}
{% if camper.pricing.enrollment_fee -%}
Enrollment Fee: {{ camper.pricing.enrollment_fee | money }}    
{% endif -%}
#########    
{% endfor %}
Donation to Lark Traditional Arts: {{ pricing.donation | money }}    

{% if not pricing.parking_pass_count -%}
You have not purchased a parking pass, be warned that it will cost a lot more
if you need to purchase one at camp.  If you meant to purchase a parking pass,
please contact the registrar to have it added to your registration.
{% endif %}
Payment info:

- Initial Payment: {{ initial_payment.type }}
- **Amount you are paying now: {{ initial_payment.total | money }}**
- Due by June 20th: {{ initial_payment.balance | money }}
- Your total: {{ pricing.total | money }}


Registration Number: ${year}-{{ registration.id }}
`;

export const confirmation_email_template = template;
export const confirmation_email_subject = subject;
export const confirmation_email_engine = 'jinja';

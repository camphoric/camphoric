import { year } from './dates.js';

const subject = 'Family Week registration confirmation';

// Jinja (SPEC §8.3): `campers`, `registration`, `pricing`, `initial_payment` and
// `event` are the server's template variables. `{%-` swallows the tag's line,
// as Mustache did for a tag alone on its line.
const template = `

Dear {{ campers[0].attributes.first_name }} {{ campers[0].attributes.last_name }},

Thank you for registering for BACDS Family Week ${year}.
This email confirms the following:

{% if registration.registration_type -%}
Staff registration type: {{ registration.registration_type.label }}
{% endif %}
Registrant address:
{%- with address = registration.attributes.address %}{% if address %}
{{ address.street_address }}
{{ address.city }}, {{ address.state_or_province }} {{ address.zip_code }}
{%- endif %}{% endwith %}

Primary phone: {{ registration.attributes.primary_phone }}   
{%- if registration.attributes.secondary_phone %}
Secondary phone: {{ registration.attributes.secondary_phone }}
{%- endif %}

**Campers:**

{% for camper in campers -%}
{%- set a = camper.attributes -%}
Name: {{ a.first_name }} {{ a.last_name }}   
{% if a.birthdate %}Age: {{ camper.pricing.age }}   {% endif %}
Email: {{ a.email }}   
Work trade: {{ 'Yes' if a.work_trade else 'No' }}   
Meals: {% if a.meal_preferences %}{{ a.meal_preferences.meal_type }}{{ ', gluten free' if a.meal_preferences.gluten_free }}{{ ', dairy free' if a.meal_preferences.dairy_free }}{{ ', food allergies' if a.meal_preferences.food_allergies }}{% endif %}   
{% if a.special_needs %}Special needs: {{ a.special_needs }}   {% endif %}
{% if a.housing_preferences %}Housing preferences: {{ a.housing_preferences }}   {% endif %}
**Total: {{ camper.pricing.total | money }}**

{% endfor -%}

---

{% if pricing.donation -%}
Family week donation: {{ pricing.donation | money }}
{% endif %}
TOTAL FOR THIS REGISTRATION:

{{ pricing.total | money }}

{% if pricing.pay_deposit -%}
You have elected to only pay a deposit of {{ pricing.deposit | money }} to hold your place at camp.
{% endif %}
Please make all checks payable to "BACDS".

Payment: Please mail your check for the above amount to the address below and include a copy of this email on which, for each person, you write what name they want on their name tag and their pronouns.

Katie Riemer   
Family Week Registrar   
1602 Addison St.   
Berkeley, CA 94703

Your registration is complete when we receive your payment. All payments must be received by May 1st. If you cancel before then, your payment will be refunded, less a \$25 per camper administration fee. If you cancel between May 1st and June 15th, 50% of your payment will be retained. Sorry, there will be no refunds for cancellations after June 15th. All cancellations must be made in writing or by email and take effect upon the day they're sent, but are final only when you receive acknowledgement from us. Registrations are not transferable. If you have to cancel due to COVID, we will offer you a full refund less a \$25 per camper administration fee.

If you have any questions, please contact registrar Katie Riemer at (510) 684-1454 or familyweek@bacds.org.

Bay Area Country Dance Society (BACDS) is an IRS-authorized 501(c)3 educational organization. Our tax ID is: 94-2576366

We look forward to seeing you on June 25th!
`;

export const confirmation_email_template = template;
export const confirmation_email_subject = subject;

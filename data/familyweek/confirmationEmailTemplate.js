import { year } from './dates.js';

const subject = 'Family Week registration confirmation';

const template = `

Dear {{campers.0.first_name}} {{campers.0.last_name}},

Thank you for registering for BACDS Family Week ${year}.
This email confirms the following:

{{#registration.registration_type}}
Staff registration type: {{label}}
{{/registration.registration_type}}

Registrant address:
{{#registration.attributes.address}}
{{street_address}}
{{city}}, {{state_or_province}} {{zip_code}}
{{/registration.attributes.address}}

Primary phone: {{registration.attributes.primary_phone}}   
{{#registration.attributes.secondary_phone}}
Secondary phone: {{registration.attributes.secondary_phone}}
{{/registration.attributes.secondary_phone}}

**Campers:**

{{#campers}}
Name: {{first_name}} {{last_name}}   
{{#birthdate}}Age: {{pricing_result.age}}   {{/birthdate}}
Email: {{email}}   
Work trade: {{#work_trade}}Yes{{/work_trade}}{{^work_trade}}No{{/work_trade}}   
Meals: {{#meal_preferences}}{{meal_type}}{{#gluten_free}}, gluten free{{/gluten_free}}{{#dairy_free}}, dairy free{{/dairy_free}}{{#food_allergies}}, food allergies{{/food_allergies}}{{/meal_preferences}}   
{{#special_needs}}Special needs: {{special_needs}}   {{/special_needs}}
{{#housing_preferences}}Housing preferences: {{housing_preferences}}   {{/housing_preferences}}
**Total: \${{pricing_result.total}}**

{{/campers}}

---

{{#pricing_results.donation}}
Family week donation: \${{pricing_results.donation}}
{{/pricing_results.donation}}

TOTAL FOR THIS REGISTRATION:

\${{pricing_results.total}}

{{#pricing_results.pay_deposit}}
You have elected to only pay a deposit of \${{pricing_results.deposit}} to hold your place at camp.
{{/pricing_results.pay_deposit}}

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

import { yearDisplay } from './dates.js';

const subject = `Camp Harmony ${yearDisplay} Registration Confirmation`;
// Jinja (SPEC §8.3): `campers`, `registration`, `pricing`, `initial_payment` and
// `event` are the server's template variables. `{%-` swallows the tag's line,
// as Mustache did for a tag alone on its line.
const template = `
Dear {{ campers[0].attributes.first_name }} {{ campers[0].attributes.last_name }},

Thank you for your online registration for Camp Harmony ${yearDisplay}! This email confirms the following:

Registration Info
{%- for camper in campers %}

**{{ camper.attributes.first_name }} {{ camper.attributes.last_name }}, {{ camper.attributes.age }}**

{{ camper.attributes.phone }}    
{{ camper.attributes.email }}    
Meals: {{ camper.attributes.meal_type }}{% for exception in camper.attributes.meal_exceptions or [] %}, {{ exception }}{% endfor %}    
Registered for {{ (camper.attributes.attendance or []) | join(', ') }}    
(You must arrive after 2pm on your first day)    
Housing: {{ camper.lodging.path_names | join(', ') if camper.lodging else 'none' }}    
Linens rental: {{ 'Yes' if camper.attributes.linens else 'No' }}    
Campership: {{ camper.pricing.campership | money }}    

------
{%- endfor %}

Total fees: {{ pricing.tuition | money }}    
Total campership donation: {{ pricing.campership_donation | money }}    

TOTAL FOR THIS REGISTRATION: {{ pricing.total | money }}    

You have elected to pay by {{ registration.payment_type }}.

If you are paying by check, make your check for **{{ pricing.total | money }}**
payable to SFFMC and mail to:

SFFMC, c/o Ellen Eagan
149 Santa Maria Avenue
San Bruno CA 94066

Checks must be received by November 15 to receive the Early Bird rate.

Each camper 2 years and older will need to take a rapid COVID test no more than 8 hours BEFORE they arrive at Camp and show proof of a negative result. Take a photo of your test with your cell phone. If you do not have a cell phone, write the date and time you took the test on the test itself, seal it in a ziploc bag and bring it to Camp. (Please test before you arrive!)
NEW THIS YEAR: Campers staying longer than 2 nights will take a COVID test 48 hours after arriving at camp. All campers should plan to bring rapid COVID tests with them.

If you would like to sign up to lead a workshop, you may do so on the
[Workshop Signup Thread](https://docs.google.com/forms/d/1ISs1zhwBzUyp4Q8inU6Z8x12dFmmLmWsjExMZPt3EKc)

You will be receiving an email with your housing assignment and additional details by December 4. Thank you for registering for Camp Harmony!

Registration Number: ${yearDisplay}CH{{ registration.id }}
`;

export const confirmation_email_template = template;
export const confirmation_email_subject = subject;
export const confirmation_email_engine = 'jinja';

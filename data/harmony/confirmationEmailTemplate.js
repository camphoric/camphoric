import { yearDisplay } from './dates.js';

const subject = `Camp Harmony ${yearDisplay} Registration Confirmation`;
const template = `
Dear {{campers.0.first_name}} {{campers.0.last_name}},

Thank you for your online registration for Camp Harmony ${yearDisplay}! This email confirms the following:

Registration Info
{{#campers}}

**{{first_name}} {{last_name}}, {{age}}**

{{phone}}    
{{email}}    
Meals: {{meal_type}}{{#meal_exceptions}}, {{.}}{{/meal_exceptions}}    
Registered for {{#attendance}}, {{.}}{{/attendance}}    
Please arrive after 2pm on your first day.    
Housing: {{lodging.lodging_requested.name}}    
Sheet Rental: {{linens}}    
Campership request: \${{campership_request}}    

------
{{/campers}}

Total fees: \${{pricing_results.tuition}}    
Total campership donation: \${{pricing_results.campership_donation}}    

TOTAL FOR THIS REGISTRATION: \${{pricing_results.total}}    

You have elected to pay by {{registration.payment_type}}.

If you are paying by check, make your check for **\${{pricing_results.total}}**
payable to SFFMC and mail to:

SFFMC, c/o Ellen Eagan
149 Santa Maria Avenue
San Bruno CA 94066

If you would like to sign up to lead a workshop, you may do so on the [Workshop Signup Thread](https://docs.google.com/forms/d/e/1FAIpQLSfe9LwY1nBqNPan8QE6lcndFJsTJpnTL3fbwK1BKFNsyumEWA/viewform?vc=0&c=0&w=1&flr=0)

You have agreed to Camp Harmony's Covid policy [link] and you will need to provide proof of a negative Covid test upon entering Camp.

You will be receiving an email with your housing assignment and additional details by December 4. Thank you for registering for Camp Harmony!

Registration Number: ${yearDisplay}CH{{ registration.id }}
`;

export const confirmation_email_template = template;
export const confirmation_email_subject = subject;

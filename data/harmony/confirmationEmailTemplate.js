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
(You must arrive after 2pm on your first day)    
Housing: {{lodging.lodging_requested.name}}    
Linens rental: {{linens}}    
Campership: \${{pricing_result.campership}}    

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

Checks must be received by November 1 to receive the Early Bird rate.

Each camper 2 years and older will need to take a rapid COVID test no more than 8 hours BEFORE they arrive at Camp and show proof of a negative result. There is no parking area for you to test when you arrive at Camp. Please test before you arrive. If you test positive for COVID before camp, a full refund less a $25 per-camper administration fee will be offered. Camp Harmony’s Covid & Cancellation policy is here. Free tests may be ordered through your health insurance and from https://www.covid.gov/tests. If you haven't had one already, consider getting a flu shot and Covid vaccine/booster to help insure a healthy Camp.

If you would like to sign up to lead a workshop, you may do so on the [Workshop Signup Thread](https://docs.google.com/forms/d/e/1FAIpQLSfe9LwY1nBqNPan8QE6lcndFJsTJpnTL3fbwK1BKFNsyumEWA/viewform?vc=0&c=0&w=1&flr=0)

You will be receiving an email with your housing assignment and additional details by December 4. Thank you for registering for Camp Harmony!

Registration Number: ${yearDisplay}CH{{ registration.id }}
`;

export const confirmation_email_template = template;
export const confirmation_email_subject = subject;

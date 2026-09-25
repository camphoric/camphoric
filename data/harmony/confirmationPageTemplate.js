import { yearDisplay } from './dates.js';

// Jinja markdown, rendered on the server when registration completes (SPEC §7.3):
// `registration`, `campers`, `pricing`, `initial_payment` and `event`.

export default `
# Your registration is confirmed!

## See you at Camp Harmony ${yearDisplay}!

If you are paying by check, make your check for **{{ pricing.total | money }}**
payable to SFFMC and mail to:

SFFMC, c/o Ellen Eagan
149 Santa Maria Avenue
San Bruno CA 94066

Checks must be received by November 15 to receive the Early Bird rate.

Questions? Email us at campnewharmony@gmail.com (preferred) or call 415-987-0502. Be patient, we are volunteers.
`;

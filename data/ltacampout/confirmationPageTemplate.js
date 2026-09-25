import { year } from './dates.js'

// Jinja markdown, rendered on the server when registration completes (SPEC §7.3):
// `registration`, `campers`, `pricing`, `initial_payment` and `event`.

export default `
# You're all set!

## See you at Jughandle Campout ${year}!

If you're paying by check, please make it for **{{ pricing.total | money }}**
payable to "Lark Traditional Arts", and mail it to:

Lark Traditional Arts
PO Box 1724
Mendocino, CA 95460
USA

Do you have questions? Email us at registration@larkcamp.org or call 707-397-5275
`;

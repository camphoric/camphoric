import { validateEventImport } from '@camphoric/camphoric-event-import-spec';
import { setUpEvent } from '@camphoric/camphoric-event-import-tools/e2e';

import event from '../index.ts';

// Starts a throwaway Camphoric (or uses CAMPHORIC_E2E_SERVER_URL's), imports
// Sample Camp with its registration open, and removes the server afterwards
export default setUpEvent({ event, validate: validateEventImport });

/** A camper's delete preview, for the CancelCamper tests and stories. */

import type { ApiDeletePreview } from 'api-types';

/** A camper with a charge of their own, which goes with them. */
export const CAMPER: ApiDeletePreview = {
  can_delete: true,
  blocked_by: [],
  deletes: [{ type: 'customcharge', name: 'custom charge', count: 1, items: ['Linens $25.00'] }],
  changes: [],
  restorable: true,
};

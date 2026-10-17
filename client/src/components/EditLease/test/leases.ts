/** Leases for the edit-lease stories and tests. */

import type { ApiEditLease } from 'api-types';

export const ALEX_EDITING: ApiEditLease = {
  id: 1,
  model: 'registration',
  object_id: 13,
  event: 4,
  holder: { id: 7, name: 'Alex Registrar' },
  client_id: 'their-tab',
  acquired_at: '2026-10-15T17:42:00Z',
  expires_at: '2026-10-15T17:45:00Z',
};

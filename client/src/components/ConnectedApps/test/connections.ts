/** Sample connected apps for the connected-apps list's tests and stories. */

import type { ApiConnectedApp } from 'api-types';

export function sampleConnection(fields: Partial<ApiConnectedApp> = {}): ApiConnectedApp {
  return {
    id: 1,
    application: { id: 7, name: 'Lark admin tool' },
    user: { id: 2, username: 'pat', name: 'Pat Alpha' },
    scopes: ['read', 'write'],
    approved_at: '2026-10-01T16:00:00Z',
    last_used_at: '2026-11-04T09:30:00Z',
    ...fields,
  };
}

export const SAMPLE_CONNECTIONS: ApiConnectedApp[] = [
  sampleConnection(),
  sampleConnection({
    id: 2,
    application: { id: 8, name: 'Roster sync' },
    user: { id: 3, username: 'sam', name: 'Sam Beta' },
    scopes: ['read'],
    last_used_at: null,
  }),
];

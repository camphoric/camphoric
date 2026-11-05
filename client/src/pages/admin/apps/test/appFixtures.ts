/** Sample registered apps for the Apps screen's tests and stories. */

import type { ApiApplication } from 'api-types';

export function sampleApp(fields: Partial<ApiApplication> = {}): ApiApplication {
  return {
    id: 7,
    name: 'Lark admin tool',
    client_id: 'Xk3vQ8bLr2yT0pWm6fN1aCq9',
    redirect_uris: ['https://admin.larkcamp.org/oauth/callback'],
    created: '2026-10-01T16:00:00Z',
    updated: '2026-10-01T16:00:00Z',
    connected_users: 3,
    ...fields,
  };
}

export const SAMPLE_APPS: ApiApplication[] = [
  sampleApp(),
  sampleApp({
    id: 8,
    name: 'Roster sync',
    client_id: 'P0dLw7sJk4hGe2nBc5vXz8Rt',
    redirect_uris: ['https://sync.example.org/cb', 'http://localhost:8080/cb'],
    connected_users: 0,
  }),
];

/** Sample personal access tokens for the token components' tests and stories. */

import type { ApiNewToken, ApiToken } from 'api-types';

export function sampleToken(fields: Partial<ApiToken> = {}): ApiToken {
  return {
    id: 1,
    name: 'Nightly export',
    prefix: 'cmph_Q2xabc12',
    read_only: true,
    created_at: '2026-10-01T16:00:00Z',
    expires_at: null,
    last_used_at: '2026-11-04T09:00:00Z',
    created_via: 'account',
    ...fields,
  };
}

export const SAMPLE_TOKENS: ApiToken[] = [
  sampleToken(),
  sampleToken({
    id: 2,
    name: 'import',
    prefix: 'cmph_Zk9pq7Rt',
    read_only: false,
    created_at: '2026-11-05T18:00:00Z',
    expires_at: '2026-11-05T20:00:00Z',
    last_used_at: null,
    created_via: 'command',
  }),
];

export const SAMPLE_NEW_TOKEN: ApiNewToken = {
  ...sampleToken({
    id: 3,
    name: 'Roster script',
    read_only: false,
    expires_at: '2026-12-06T18:00:00Z',
    last_used_at: null,
  }),
  prefix: 'cmph_7fGh2kLm',
  token: 'cmph_7fGh2kLmN0pQrStUvWxYz0123456789abcdefghijkl',
};

/**
 * The release the server runs (GET /api/version), shown in the site-level
 * admin header (SPEC §8.1). It can't change without a restart, so it's fetched once.
 */

import { useQuery } from '@tanstack/react-query';
import type { ApiVersion } from 'api-types';
import { apiFetch } from 'utils/fetch';

export function useServerVersion() {
  return useQuery({
    queryKey: ['serverVersion'],
    queryFn: ({ signal }) => apiFetch<ApiVersion>('/api/version', { signal }),
    staleTime: Infinity,
  });
}

/** `v0.12.0`, or "unknown version" when the server isn't a release. */
export function formatVersion(version: string | null | undefined): string {
  return version ? `v${version}` : 'unknown version';
}

/**
 * Application bootstrap (SPEC §3). Before any route renders, perform a two-step
 * init behind a spinner:
 *   1. GET /api/set-csrf-cookie — must return { detail: "CSRF cookie set" }.
 *   2. GET /api/user — the current user (prefetched into the query cache).
 * Only after both succeed does the router mount. Any failure retries from
 * scratch. All requests send credentials; mutations carry the CSRF token.
 */

import { RouterProvider } from '@tanstack/react-router';
import { anonymousUser,type ApiUser } from 'api-types';
import { FullScreenLoading } from 'components/Loading';
import { WHOAMI_KEY } from 'hooks/auth';
import { router } from 'navigation/router';
import { useEffect, useState } from 'react';
import { queryClient } from 'store/queryClient';
import { apiFetch } from 'utils/fetch';

const RETRY_DELAY_MS = 2000;

async function bootstrap(signal: AbortSignal): Promise<void> {
  const csrf = await apiFetch<{ detail?: string }>('/api/set-csrf-cookie', { signal });
  if (csrf?.detail !== 'CSRF cookie set') {
    throw new Error('Unexpected CSRF bootstrap response');
  }

  // Seed the whoami cache so the router/guard renders with the user already
  // known. Fall back to anonymous if the endpoint is unreachable.
  await queryClient.prefetchQuery({
    queryKey: WHOAMI_KEY,
    queryFn: ({ signal: querySignal }) => apiFetch<ApiUser>('/api/user', { signal: querySignal }),
  });
  if (queryClient.getQueryData(WHOAMI_KEY) === undefined) {
    queryClient.setQueryData(WHOAMI_KEY, anonymousUser);
  }
}

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let retryTimer: number | undefined;

    const run = () => {
      bootstrap(controller.signal)
        .then(() => {
          if (!cancelled) setReady(true);
        })
        .catch(() => {
          // Retry from scratch on any failure (SPEC §3, §11 resilience).
          if (!cancelled) retryTimer = window.setTimeout(run, RETRY_DELAY_MS);
        });
    };
    run();

    return () => {
      cancelled = true;
      controller.abort();
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, []);

  if (!ready) {
    return <FullScreenLoading message="Starting up…" />;
  }

  return <RouterProvider router={router} />;
}

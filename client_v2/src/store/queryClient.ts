/**
 * The single TanStack Query client serving both API roots (admin /api and
 * public registration /api/events). Server state lives here; the only global
 * client state is the Zustand registration store (SPEC §5, DR-1).
 *
 * A shared MutationCache surfaces mutation failures as notifications (DR-10).
 * Individual mutations opt out with `meta: { suppressErrorNotification: true }`.
 */

import { notifications } from '@mantine/notifications';
import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from 'utils/fetch';

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.body && typeof error.body === 'object') {
      const detail = (error.body as Record<string, unknown>).detail;
      if (typeof detail === 'string') return detail;
    }
    return `${error.status} ${error.statusText}`;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.suppressErrorNotification) return;
      notifications.show({
        color: 'red',
        title: 'Request failed',
        message: describeError(error),
      });
    },
  }),
  defaultOptions: {
    queries: {
      // Admin data should feel fresh but not thrash; per-query overrides apply
      // (the registration config opts out of refetch-on-focus — DR-16).
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

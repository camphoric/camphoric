/**
 * The single TanStack Query client serving both API roots (admin /api and
 * public registration /api/events). Server state lives here; the only global
 * client state is the Zustand registration store (SPEC §5, DR-1).
 *
 * A shared MutationCache surfaces mutation failures as notifications (DR-10).
 * Individual mutations opt out with `meta: { suppressErrorNotification: true }`,
 * or, for a save refused because someone else changed the record first,
 * `meta: { handlesVersionConflict: true }` (DR-109).
 *
 * A 401 means the admin's session has lapsed: rather than report it, both caches
 * re-check who's signed in, so the auth guard asks them to sign in again without
 * navigating away from the URL (SPEC §6, DR-9).
 */

import { notifications } from '@mantine/notifications';
import { hashKey, MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import type { ApiUser, TemplateDiagnostic } from 'api-types';
import { ApiError, versionConflict } from 'utils/fetch';

/**
 * A mutation error as one line: for a 412, that someone else changed the record
 * first; for a 403, that the user lacks permission; otherwise the API's `detail` (plus the first template problem, when the API
 * returns `diagnostics`), or its field errors (`field: message`), or the HTTP
 * status.
 */
export function describeError(error: unknown): string {
  if (versionConflict(error)) {
    return 'Someone else changed this since you opened it, so your change wasn’t saved.';
  }
  if (error instanceof ApiError && error.status === 403) {
    // A refusal the admin didn't hide (SPEC §10, DR-51), or a signed-out session.
    const body = error.body as { code?: unknown } | null;
    if (body?.code !== 'password_change_required') {
      return "You don't have permission to do that.";
    }
  }
  if (error instanceof ApiError) {
    if (error.body && typeof error.body === 'object' && !Array.isArray(error.body)) {
      const body = error.body as Record<string, unknown>;
      if (typeof body.detail === 'string') {
        const [first] = Array.isArray(body.diagnostics)
          ? (body.diagnostics as TemplateDiagnostic[])
          : [];
        if (!first) return body.detail;
        return `${body.detail} ${first.line ? `Line ${first.line}: ` : ''}${first.message}`;
      }
      const fields = Object.entries(body)
        .map(([field, messages]) => {
          const text = Array.isArray(messages) ? messages.join(' ') : String(messages);
          return `${field.replace(/_/g, ' ')}: ${text}`;
        })
        .join('; ');
      if (fields) return fields;
    }
    return `${error.status} ${error.statusText}`;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}

/**
 * The server refuses everything until a password set by a superuser is changed
 * (DR-52). Refreshing who's signed in shows the change-password screen.
 */
function passwordChangeRequired(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 403) return false;
  const body = error.body as { code?: unknown } | null;
  return body?.code === 'password_change_required';
}

// Mirrors hooks/auth WHOAMI_KEY (importing it here would pull hooks into the store).
const WHOAMI = ['WhoAmI'];

/** Whether the cached whoami answer has someone signed in. */
const signedIn = () => {
  const user = queryClient.getQueryData<ApiUser>(WHOAMI);
  return !!user && user.username !== '';
};

/**
 * A 401 in the admin: the session has lapsed (DR-9). Only the admin's auth guard
 * watches who's signed in, so a 401 in the anonymous registration flow never counts.
 */
function sessionLapsed(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 401) return false;
  return !!queryClient.getQueryCache().find({ queryKey: WHOAMI, exact: true })?.isActive();
}

/**
 * Re-check who's signed in, as the session monitor does (DR-26). When the session
 * is gone the guard shows the sign-in form, without navigating, so the attempted
 * URL is kept. Resolves to whether someone is still signed in.
 */
async function recheckSession(): Promise<boolean> {
  // Several requests can fail together: share the check in flight, don't restart it.
  await queryClient.invalidateQueries({ queryKey: WHOAMI, exact: true }, { cancelRefetch: false });
  return signedIn();
}

function reportFailure(error: unknown, meta: Record<string, unknown> | undefined) {
  if (meta?.suppressErrorNotification) return;
  if (meta?.handlesVersionConflict && versionConflict(error)) return;
  notifications.show({
    color: 'red',
    title: 'Request failed',
    message: describeError(error),
  });
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (passwordChangeRequired(error)) {
        void queryClient.invalidateQueries({ queryKey: WHOAMI });
      } else if (sessionLapsed(error) && query.queryHash !== hashKey(WHOAMI) && signedIn()) {
        // (Never for the whoami check itself: re-checking it would loop. Nor once
        // the check has already found them signed out.)
        void recheckSession();
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (passwordChangeRequired(error)) {
        void queryClient.invalidateQueries({ queryKey: WHOAMI });
        return;
      }
      if (sessionLapsed(error)) {
        // The sign-in form takes the toast's place, unless the server says they're
        // still signed in. When an earlier check already found them signed out, the
        // form is showing: there's nothing to re-check or report.
        if (signedIn()) {
          void recheckSession().then((still) => {
            if (still) reportFailure(error, mutation.meta);
          });
        }
        return;
      }
      reportFailure(error, mutation.meta);
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

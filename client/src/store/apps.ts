/**
 * Apps using OAuth (SPEC §6, §8.10; §15 DR-146, DR-149): the apps you've
 * connected to your account, and disconnecting one; for Admins, a user's
 * connected apps, and the registered apps — registering one (its secret shown
 * once), renaming it or changing its redirect URIs, a new secret, who has it
 * connected, and removing it.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiApplication,
  ApiApplicationSecret,
  ApiConnectedApp,
  ApiOAuthDecision,
  ApiOAuthRefusal,
  ApiOAuthRequest,
  ApplicationRequest,
} from 'api-types';
import { ApiError, apiFetch } from 'utils/fetch';

// Every list of connections, so a disconnect anywhere refreshes them all.
const CONNECTIONS = 'ConnectedApp';
const APPLICATIONS = 'Application';

// --- Approving an app (the OAuth consent page; SPEC §6; §15 DR-152) -----------------

/** The API's address for the app's authorization request, which is passed on as sent. */
const authorizationRequestUrl = (query: string) => `/api/oauth/authorize?${query}`;

/** What the app's request asks for (`query` is the request's query string). */
export function useOAuthRequest(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ['OAuthRequest', query],
    queryFn: ({ signal }) => apiFetch<ApiOAuthRequest>(authorizationRequestUrl(query), { signal }),
    enabled,
    // A refusal is the answer, not a hiccup.
    retry: false,
  });
}

/** Connect the app (true) or cancel (false): where to send the person next. */
export function useDecideOAuthRequest(query: string) {
  return useMutation({
    mutationFn: (allow: boolean) =>
      apiFetch<ApiOAuthDecision>(authorizationRequestUrl(query), {
        method: 'POST',
        body: { allow },
      }),
    meta: { suppressErrorNotification: true },
  });
}

/** Why the app's request can't be approved, from its 400; null for any other error. */
export function oauthRefusal(error: unknown): ApiOAuthRefusal | null {
  if (!(error instanceof ApiError) || error.status !== 400) return null;
  const body = error.body as Partial<ApiOAuthRefusal> | null;
  if (typeof body?.error !== 'string') return null;
  return {
    error: body.error,
    description: typeof body.description === 'string' ? body.description : '',
    redirect_to: typeof body.redirect_to === 'string' ? body.redirect_to : null,
  };
}

// --- Connected and registered apps --------------------------------------------------

/** The apps you've connected to your account. */
export function useMyConnectedApps(enabled = true) {
  return useQuery({
    queryKey: [CONNECTIONS, 'mine'],
    queryFn: ({ signal }) => apiFetch<ApiConnectedApp[]>('/api/user/apps', { signal }),
    enabled,
  });
}

/** A user's connected apps, as an Admin sees them. */
export function useUserConnectedApps(userId: number | undefined) {
  return useQuery({
    queryKey: [CONNECTIONS, 'user', userId],
    queryFn: ({ signal }) => apiFetch<ApiConnectedApp[]>(`/api/users/${userId}/apps/`, { signal }),
    enabled: userId !== undefined,
  });
}

/** Who has the app connected (Admins). */
export function useApplicationConnections(applicationId: number | undefined) {
  return useQuery({
    queryKey: [CONNECTIONS, 'application', applicationId],
    queryFn: ({ signal }) =>
      apiFetch<ApiConnectedApp[]>(`/api/applications/${applicationId}/connections/`, { signal }),
    enabled: applicationId !== undefined,
  });
}

function useInvalidateApps() {
  const client = useQueryClient();
  return () =>
    Promise.all(
      // A change is in someone's history too.
      [CONNECTIONS, APPLICATIONS, 'History'].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

/**
 * End an app's access to an account: yours (`userId` left out), or — for an
 * Admin — someone else's.
 */
export function useDisconnectApp() {
  const invalidate = useInvalidateApps();
  return useMutation({
    mutationFn: ({
      applicationId,
      userId,
    }: {
      applicationId: number;
      userId?: number;
      /** Which connection it is, to show it busy; not sent. */
      connectionId?: number;
    }) =>
      apiFetch<void>(
        userId === undefined
          ? `/api/user/apps/${applicationId}`
          : `/api/users/${userId}/apps/${applicationId}/`,
        { method: 'DELETE' },
      ),
    onSuccess: invalidate,
  });
}

/** The registered apps (Admins). */
export function useApplications(enabled = true) {
  return useQuery({
    queryKey: [APPLICATIONS, 'list'],
    queryFn: ({ signal }) => apiFetch<ApiApplication[]>('/api/applications/', { signal }),
    enabled,
  });
}

/** Register an app; the answer carries its secret, which is never shown again. */
export function useCreateApplication() {
  const invalidate = useInvalidateApps();
  return useMutation({
    mutationFn: (body: ApplicationRequest) =>
      apiFetch<ApiApplication & ApiApplicationSecret>('/api/applications/', {
        method: 'POST',
        body,
      }),
    meta: { suppressErrorNotification: true },
    onSuccess: invalidate,
  });
}

/** Rename an app or change its redirect URIs (form errors are shown inline). */
export function useUpdateApplication() {
  const invalidate = useInvalidateApps();
  return useMutation({
    mutationFn: ({ id, ...body }: ApplicationRequest & { id: number }) =>
      apiFetch<ApiApplication>(`/api/applications/${id}/`, { method: 'PATCH', body }),
    meta: { suppressErrorNotification: true },
    onSuccess: invalidate,
  });
}

/** A new secret for the app; the old one stops working. */
export function useNewApplicationSecret() {
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<ApiApplicationSecret>(`/api/applications/${id}/new-secret/`, { method: 'POST' }),
  });
}

/** Remove an app, ending every user's access through it. */
export function useDeleteApplication() {
  const invalidate = useInvalidateApps();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/applications/${id}/`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

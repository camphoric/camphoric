/**
 * Authentication hooks (SPEC §6, DR-9, DR-26). Session auth + CSRF; the whoami
 * endpoint (GET /api/user) is the source of truth for the current user and
 * doubles as the cheap session/keep-alive check.
 *
 * The query cache holds one user's data, so it is emptied on sign-out and when
 * someone other than the last signed-in user signs in (SPEC §6).
 */

import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { anonymousUser, type ApiUser } from 'api-types';
import { useEffect } from 'react';
import { apiFetch } from 'utils/fetch';

export const WHOAMI_KEY = ['WhoAmI'] as const;

/**
 * The id of the last user seen signed in, per query client. It outlives a
 * session that expires, so signing back in as the same user keeps their cached
 * data, while signing in as anyone else drops it.
 */
const lastSignedIn = new WeakMap<QueryClient, number>();

/** Every query but whoami, which the sign-in/out sets itself. */
const allButWhoAmI = {
  predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== WHOAMI_KEY[0],
};

/** The current user, or the anonymous user when logged out. */
export function useCurrentUser() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: WHOAMI_KEY,
    queryFn: ({ signal }) => apiFetch<ApiUser>('/api/user', { signal }),
    staleTime: 10_000,
  });
  const signedInId = isAuthenticated(query.data) ? (query.data?.id ?? null) : null;
  useEffect(() => {
    if (signedInId !== null) lastSignedIn.set(client, signedInId);
  }, [client, signedInId]);
  return query;
}

export function isAuthenticated(user: ApiUser | undefined): boolean {
  return !!user && user.username !== '';
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (credentials: LoginCredentials) =>
      apiFetch<ApiUser>('/api/login', { method: 'POST', body: credentials }),
    onSuccess: (user) => {
      // The login response is the new whoami, so the app goes straight to the
      // signed-in user. Another user's data is reset (not removed) so any view
      // still mounted drops it and refetches as the new user.
      const previous = lastSignedIn.get(client);
      client.setQueryData(WHOAMI_KEY, user);
      if (user.id !== null) lastSignedIn.set(client, user.id);
      if (previous !== user.id) void client.resetQueries(allButWhoAmI);
      return client.invalidateQueries({ queryKey: WHOAMI_KEY });
    },
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>('/api/logout', { method: 'POST' }),
    onSuccess: () => {
      client.setQueryData(WHOAMI_KEY, anonymousUser);
      // Removed rather than reset: the admin views unmount, so nothing refetches.
      client.removeQueries(allButWhoAmI);
      void client.invalidateQueries({ queryKey: WHOAMI_KEY });
    },
  });
}

// --- Passwords (SPEC §6; §15 DR-52) ------------------------------------------------
// Errors are shown inline on these forms, not as notifications.

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

/** Change your own password (and clear a must-change-password flag). */
export function useChangePassword() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) =>
      apiFetch<void>('/api/user/password', { method: 'POST', body }),
    meta: { suppressErrorNotification: true },
    onSuccess: () => client.invalidateQueries({ queryKey: WHOAMI_KEY }),
  });
}

/** Ask for a set-password link by email; the answer is the same for any address. */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<{ detail: string }>('/api/password-reset', { method: 'POST', body: { email } }),
    meta: { suppressErrorNotification: true },
  });
}

/** Whether a set-password link still works → the username it's for. */
export function usePasswordResetCheck(uid: string, token: string) {
  return useQuery({
    queryKey: ['PasswordReset', uid, token],
    queryFn: ({ signal }) =>
      apiFetch<{ username: string }>(`/api/password-reset/${uid}/${token}`, { signal }),
    retry: false,
    staleTime: Infinity,
  });
}

/** Choose a password through a set-password link. */
export function useSetPasswordWithToken(uid: string, token: string) {
  return useMutation({
    mutationFn: (newPassword: string) =>
      apiFetch<void>(`/api/password-reset/${uid}/${token}`, {
        method: 'POST',
        body: { new_password: newPassword },
      }),
    meta: { suppressErrorNotification: true },
  });
}

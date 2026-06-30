/**
 * Authentication hooks (SPEC §6, DR-9, DR-26). Session auth + CSRF; the whoami
 * endpoint (GET /api/user) is the source of truth for the current user and
 * doubles as the cheap session/keep-alive check.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { anonymousUser,type ApiUser } from 'api-types';
import { apiFetch } from 'utils/fetch';

export const WHOAMI_KEY = ['WhoAmI'] as const;

/** The current user, or the anonymous user when logged out. */
export function useCurrentUser() {
  return useQuery({
    queryKey: WHOAMI_KEY,
    queryFn: ({ signal }) => apiFetch<ApiUser>('/api/user', { signal }),
    // Treat as logged-out rather than erroring if the endpoint is unreachable.
    initialData: undefined,
    staleTime: 10_000,
  });
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
    onSuccess: () => client.invalidateQueries({ queryKey: WHOAMI_KEY }),
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>('/api/logout', { method: 'POST' }),
    onSuccess: () => {
      client.setQueryData(WHOAMI_KEY, anonymousUser);
      void client.invalidateQueries({ queryKey: WHOAMI_KEY });
    },
  });
}

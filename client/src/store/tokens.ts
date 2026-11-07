/**
 * Personal access tokens (SPEC §6; #965): the tokens your scripts use to act as
 * you — listing them, making one (the token shown once) and revoking one; for
 * Admins, a user's tokens, and revoking one of theirs.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiNewToken, ApiToken, NewTokenRequest } from 'api-types';
import { ApiError, apiFetch } from 'utils/fetch';

// Every list of tokens, so a change anywhere refreshes them all.
const TOKENS = 'ApiToken';

/** Your personal access tokens. */
export function useMyTokens(enabled = true) {
  return useQuery({
    queryKey: [TOKENS, 'mine'],
    queryFn: ({ signal }) => apiFetch<ApiToken[]>('/api/user/tokens', { signal }),
    enabled,
  });
}

/** A user's personal access tokens, as an Admin sees them. */
export function useUserTokens(userId: number | undefined) {
  return useQuery({
    queryKey: [TOKENS, 'user', userId],
    queryFn: ({ signal }) => apiFetch<ApiToken[]>(`/api/users/${userId}/tokens/`, { signal }),
    enabled: userId !== undefined,
  });
}

function useInvalidateTokens() {
  const client = useQueryClient();
  return () =>
    Promise.all(
      // Making or revoking a token is in someone's history too.
      [TOKENS, 'History'].map((key) => client.invalidateQueries({ queryKey: [key] })),
    );
}

/** Make a token for yourself; the answer carries the token, which is never shown again. */
export function useCreateToken() {
  const invalidate = useInvalidateTokens();
  return useMutation({
    mutationFn: (body: NewTokenRequest) =>
      apiFetch<ApiNewToken>('/api/user/tokens', { method: 'POST', body }),
    // Field errors are shown on the form.
    meta: { suppressErrorNotification: true },
    onSuccess: invalidate,
  });
}

/**
 * Why an Admin's revoke found nothing: for a user with Django access the server
 * lets only a superuser revoke, and answers 404 to anyone else — an Admin who
 * isn't one can't tell such a user apart (`django_access` is for superusers).
 */
export const NOT_FOUND_FOR_ADMIN =
  'That token can’t be revoked. It may already be gone — or, for someone with Django access, only a superuser can revoke their tokens.';

/**
 * Revoke a token: yours (`userId` left out), or — for an Admin — someone
 * else's. Whatever uses it is refused from then on.
 */
export function useRevokeToken() {
  const invalidate = useInvalidateTokens();
  return useMutation({
    mutationFn: async ({ tokenId, userId }: { tokenId: number; userId?: number }) => {
      if (userId === undefined) {
        return apiFetch<void>(`/api/user/tokens/${tokenId}`, { method: 'DELETE' });
      }
      try {
        return await apiFetch<void>(`/api/users/${userId}/tokens/${tokenId}/`, {
          method: 'DELETE',
        });
      } catch (error) {
        // Said in full, in place of the server's bare "Not found".
        if (error instanceof ApiError && error.status === 404) {
          throw new ApiError(404, error.statusText, { detail: NOT_FOUND_FOR_ADMIN });
        }
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

/**
 * The public unsubscribe page (SPEC §8.9; §15 DR-48, DR-154): what an emailed
 * link unsubscribes, by its signed token, and confirming it. No sign-in: the
 * token is the permission. A link that can't be used is an error carrying why
 * (`ApiUnsubscribeProblem`).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiUnsubscribeLink, ApiUnsubscribeProblem } from 'api-types';
import { ApiError, apiFetch } from 'utils/fetch';

const unsubscribeUrl = (token: string) => `/api/email/unsubscribe/${encodeURIComponent(token)}`;

const key = (token: string) => ['UnsubscribeLink', token];

/** What the link unsubscribes; reading it changes nothing. */
export function useUnsubscribeLink(token: string) {
  return useQuery({
    queryKey: key(token),
    queryFn: ({ signal }) => apiFetch<ApiUnsubscribeLink>(unsubscribeUrl(token), { signal }),
    retry: false,
    meta: { suppressErrorNotification: true },
  });
}

/** Confirm: unsubscribe the link's address from the event's group email. */
export function useUnsubscribe(token: string) {
  const client = useQueryClient();
  return useMutation({
    // A read already under way (say, on returning to the tab) mustn't undo the answer.
    onMutate: () => client.cancelQueries({ queryKey: key(token) }),
    mutationFn: () => apiFetch<ApiUnsubscribeLink>(unsubscribeUrl(token), { method: 'POST' }),
    onSuccess: (link) => client.setQueryData(key(token), link),
    meta: { suppressErrorNotification: true },
  });
}

/** Why the link can't be used, when the server said. */
export function unsubscribeProblem(error: unknown): ApiUnsubscribeProblem | null {
  if (error instanceof ApiError && error.body && typeof error.body === 'object') {
    const body = error.body as Partial<ApiUnsubscribeProblem>;
    if ((body.code === 'invalid' || body.code === 'gone') && typeof body.detail === 'string') {
      return body as ApiUnsubscribeProblem;
    }
  }
  return null;
}

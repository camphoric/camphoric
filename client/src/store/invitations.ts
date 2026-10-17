/**
 * Sending an invitation (SPEC §8.4) — POST /api/invitations/{id}/send. Not a
 * CRUD verb, so it lives outside the entity-hooks factory; on success it
 * invalidates Invitation queries so the list reflects the new sent time.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiInvitation } from 'api-types';
import { apiFetch } from 'utils/fetch';

export function useSendInvitation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<ApiInvitation>(`/api/invitations/${id}/send`, { method: 'POST' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['Invitation'] }),
  });
}

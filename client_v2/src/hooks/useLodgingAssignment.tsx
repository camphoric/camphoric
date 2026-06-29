/**
 * Optimistic camper→lodging assignment (SPEC §8.6). Backs the lodging timeline
 * and hierarchy: a move patches the cached camper immediately (so the bar/row
 * jumps without waiting for the round-trip), shows a "Moving <name>…" toast that
 * turns into a green check on success, and rolls the cache back on failure.
 *
 * The global failure toast (DR-10) is suppressed here — this mutation owns its
 * own progress/finish/error toast.
 */

import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiCamper, Scalar } from 'api-types';
import { camperName } from 'utils/camper';
import { apiFetch } from 'utils/fetch';

interface MoveVars {
  camper: ApiCamper;
  lodging: Scalar | null;
  stay: string[] | null;
}

interface MoveContext {
  snapshot: [QueryKey, ApiCamper[] | undefined][];
  toastId: string;
  name: string;
}

export function useLodgingAssignment() {
  const client = useQueryClient();

  return useMutation<ApiCamper, Error, MoveVars, MoveContext>({
    meta: { suppressErrorNotification: true },
    mutationFn: ({ camper, lodging, stay }) =>
      apiFetch<ApiCamper>(`/api/campers/${camper.id}/`, {
        method: 'PATCH',
        body: { id: camper.id, lodging, stay },
      }),

    onMutate: async ({ camper, lodging, stay }) => {
      const name = camperName(camper);
      const toastId = `lodging-move-${camper.id}`;
      notifications.show({
        id: toastId,
        loading: true,
        message: `Moving ${name}…`,
        autoClose: false,
        withCloseButton: false,
      });

      // Patch the camper in every cached camper list so the lodging views
      // (which derive from it) reflect the move immediately.
      await client.cancelQueries({ queryKey: ['Camper', 'list'] });
      const snapshot = client.getQueriesData<ApiCamper[]>({ queryKey: ['Camper', 'list'] });
      client.setQueriesData<ApiCamper[]>({ queryKey: ['Camper', 'list'] }, (old) =>
        old?.map((c) => (String(c.id) === String(camper.id) ? { ...c, lodging, stay } : c)),
      );

      return { snapshot, toastId, name };
    },

    onError: (_error, _vars, ctx) => {
      if (!ctx) return;
      ctx.snapshot.forEach(([key, data]) => client.setQueryData(key, data));
      notifications.update({
        id: ctx.toastId,
        loading: false,
        color: 'red',
        icon: <IconX size={16} />,
        message: `Couldn't move ${ctx.name}`,
        autoClose: 4000,
        withCloseButton: true,
      });
    },

    onSuccess: (_data, _vars, ctx) => {
      notifications.update({
        id: ctx.toastId,
        loading: false,
        color: 'green',
        icon: <IconCheck size={16} />,
        message: `Moved ${ctx.name}`,
        autoClose: 1500,
        withCloseButton: false,
      });
    },

    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['Camper'] });
      void client.invalidateQueries({ queryKey: ['Registration'] });
    },
  });
}

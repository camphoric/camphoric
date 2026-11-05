/**
 * Asking before an app is disconnected (SPEC §6, §8.10; §15 DR-149): it loses
 * its access to the account at once, and gets it back only if it's approved
 * again.
 */

import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import type { ApiConnectedApp } from 'api-types';

export function confirmDisconnect({
  connection,
  yours,
  onConfirm,
}: {
  connection: ApiConnectedApp;
  /** Your own account, or someone else's (an Admin's view). */
  yours: boolean;
  onConfirm: () => void;
}) {
  const account = yours ? 'your account' : `${connection.user.username}’s account`;
  modals.openConfirmModal({
    title: `Disconnect ${connection.application.name}?`,
    children: (
      <Text size="sm">
        {connection.application.name} loses its access to {account} at once. It can get access again
        only if {yours ? 'you approve' : `${connection.user.username} approves`} it again.
      </Text>
    ),
    labels: { confirm: 'Disconnect', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    onConfirm,
  });
}

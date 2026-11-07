/**
 * Asking before a personal access token is revoked (SPEC §6; #965): whatever
 * uses it is refused at once, and it can't be brought back — a script that
 * still needs access needs a new token.
 */

import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import type { ApiToken } from 'api-types';

export function confirmRevokeToken({
  token,
  ownerUsername,
  onConfirm,
}: {
  token: ApiToken;
  /** Whose token it is, in an Admin's view of someone else's; left out for your own. */
  ownerUsername?: string;
  onConfirm: () => void;
}) {
  const account = ownerUsername === undefined ? 'your account' : `${ownerUsername}’s account`;
  modals.openConfirmModal({
    title: `Revoke ${token.name}?`,
    children: (
      <Text size="sm">
        Anything using {token.prefix}… on {account} is refused from now on. It can’t be undone: a
        script that still needs access needs a new token.
      </Text>
    ),
    labels: { confirm: 'Revoke', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    onConfirm,
  });
}

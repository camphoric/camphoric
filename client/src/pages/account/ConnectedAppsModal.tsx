/**
 * Your connected apps (SPEC §6; §15 DR-146, DR-149): the apps you've approved
 * to use your account, what each may do, when you approved it and when it was
 * last used; disconnecting one ends its access at once.
 */

import { Alert, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { confirmDisconnect, ConnectedAppsList } from 'components/ConnectedApps';
import { InlineLoading } from 'components/Loading';
import { useDisconnectApp, useMyConnectedApps } from 'store/apps';
import { apiErrorMessage } from 'utils/fetch';

interface ConnectedAppsModalProps {
  opened: boolean;
  onClose: () => void;
}

export function ConnectedAppsModal({ opened, onClose }: ConnectedAppsModalProps) {
  const connections = useMyConnectedApps(opened);
  const disconnect = useDisconnectApp();
  return (
    <Modal opened={opened} onClose={onClose} title="Connected apps" size="lg">
      <Stack>
        <Text size="sm" c="dimmed">
          Apps you’ve let use your Camphoric account. Each acts as you, and can never do more than
          your permission group allows.
        </Text>
        {connections.isPending ? (
          <InlineLoading />
        ) : connections.isError ? (
          <Alert color="red">{apiErrorMessage(connections.error)}</Alert>
        ) : (
          <ConnectedAppsList
            connections={connections.data}
            show="application"
            emptyMessage="You haven’t connected any apps to your account."
            disconnectingId={disconnect.isPending ? disconnect.variables?.connectionId : undefined}
            onDisconnect={(connection) =>
              confirmDisconnect({
                connection,
                yours: true,
                onConfirm: () =>
                  disconnect.mutate(
                    { applicationId: connection.application.id, connectionId: connection.id },
                    {
                      onSuccess: () =>
                        notifications.show({
                          color: 'green',
                          message: `${connection.application.name} is disconnected.`,
                        }),
                    },
                  ),
              })
            }
          />
        )}
      </Stack>
    </Modal>
  );
}

/**
 * Apps (SPEC §8.10; §15 DR-146, DR-149), for Admins only, shown in the Apps
 * overlay (AppsOverlay): the apps registered to use Camphoric's API for the
 * people who approve them. Register one (`?appId=new`; its secret is shown
 * once) or edit one (`?appId=<id>`); see its setup details and who has it
 * connected, disconnecting anyone; give it a new secret; or remove it, which
 * ends everyone's access through it. Its search params ride on the URL of the
 * page under the overlay.
 */

import { Alert, Button, Container, Group, Modal, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import type { ApiApplication, ApplicationRequest } from 'api-types';
import { confirmDisconnect, ConnectedAppsList } from 'components/ConnectedApps';
import { InlineLoading } from 'components/Loading';
import { usePermissions } from 'hooks/permissions';
import { useOverlay } from 'navigation/overlay';
import { useState } from 'react';
import {
  useApplicationConnections,
  useApplications,
  useCreateApplication,
  useDeleteApplication,
  useDisconnectApp,
  useNewApplicationSecret,
  useUpdateApplication,
} from 'store/apps';
import { apiErrorMessage } from 'utils/fetch';

import { AppCredentials } from './AppCredentials';
import { AppForm } from './AppForm';
import { AppsTable, connectedLabel } from './AppsTable';

interface Credentials {
  name: string;
  clientId: string;
  /** Only right after it's made. */
  secret?: string;
}

export function AppsPage() {
  const { canManageApps } = usePermissions();
  const { search, setSearch } = useOverlay();
  const { appId } = search;
  const narrow = useMediaQuery('(max-width: 48em)');
  const { data: apps, error } = useApplications(canManageApps);
  const create = useCreateApplication();
  const update = useUpdateApplication();
  const newSecret = useNewApplicationSecret();
  const remove = useDeleteApplication();
  const disconnect = useDisconnectApp();
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [connectionsOf, setConnectionsOf] = useState<ApiApplication | null>(null);
  const connections = useApplicationConnections(connectionsOf?.id);

  // Hidden from everyone but Admins.
  if (!canManageApps) return null;

  const editing = appId && appId !== 'new' ? apps?.find((a) => String(a.id) === appId) : undefined;
  const formOpen = appId === 'new' || !!editing;
  const openForm = (id?: string) => setSearch({ appId: id });

  const save = (values: ApplicationRequest) => {
    if (editing) {
      update.mutate(
        { id: editing.id, ...values },
        {
          onSuccess: () => {
            notifications.show({ color: 'green', message: 'Saved' });
            openForm(undefined);
          },
        },
      );
    } else {
      create.mutate(values, {
        onSuccess: (app) => {
          openForm(undefined);
          setCredentials({ name: app.name, clientId: app.client_id, secret: app.client_secret });
        },
      });
    }
  };

  const actions = {
    onShowSetup: (app: ApiApplication) =>
      setCredentials({ name: app.name, clientId: app.client_id }),
    onEdit: (app: ApiApplication) => openForm(String(app.id)),
    onShowConnections: (app: ApiApplication) => setConnectionsOf(app),
    onNewSecret: (app: ApiApplication) =>
      modals.openConfirmModal({
        title: `Give ${app.name} a new secret?`,
        children: (
          <Text size="sm">
            Its current secret stops working at once, so it can’t get tokens until whoever runs it
            puts in the new one. Nobody’s connection to it ends.
          </Text>
        ),
        labels: { confirm: 'New secret', cancel: 'Cancel' },
        onConfirm: () =>
          newSecret.mutate(app.id, {
            onSuccess: ({ client_secret }) =>
              setCredentials({ name: app.name, clientId: app.client_id, secret: client_secret }),
          }),
      }),
    onDelete: (app: ApiApplication) =>
      modals.openConfirmModal({
        title: `Remove ${app.name}?`,
        children: (
          <Text size="sm">
            Its access to every account ends at once ({connectedLabel(app.connected_users)}), and it
            can’t be connected again unless it’s registered again, with a new client ID.
          </Text>
        ),
        labels: { confirm: 'Remove', cancel: 'Cancel' },
        confirmProps: { color: 'red' },
        onConfirm: () =>
          remove.mutate(app.id, {
            onSuccess: () =>
              notifications.show({ color: 'green', message: `${app.name} is removed.` }),
          }),
      }),
  };

  return (
    <Container size="md">
      <Stack>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Apps that may use Camphoric for the people who approve them. Each acts as the person,
            never with more than their permission group allows.
          </Text>
          <Button leftSection={<IconPlus size={16} />} onClick={() => openForm('new')}>
            Register app
          </Button>
        </Group>
        {error ? (
          <Alert color="red">{apiErrorMessage(error)}</Alert>
        ) : apps ? (
          <AppsTable apps={apps} {...actions} />
        ) : (
          <InlineLoading message="Loading apps…" />
        )}
      </Stack>

      <Modal
        opened={formOpen}
        onClose={() => openForm(undefined)}
        title={editing ? `Edit ${editing.name}` : 'Register an app'}
        size="lg"
        fullScreen={narrow}
      >
        {formOpen && (
          <AppForm
            key={appId}
            app={editing}
            saving={create.isPending || update.isPending}
            error={editing ? update.error : create.error}
            onSubmit={save}
            onCancel={() => openForm(undefined)}
          />
        )}
      </Modal>

      <Modal
        opened={credentials !== null}
        onClose={() => setCredentials(null)}
        title={credentials ? `Setting up ${credentials.name}` : ''}
        size="lg"
        fullScreen={narrow}
      >
        {credentials && (
          <AppCredentials
            clientId={credentials.clientId}
            clientSecret={credentials.secret}
            origin={window.location.origin}
          />
        )}
      </Modal>

      <Modal
        opened={connectionsOf !== null}
        onClose={() => setConnectionsOf(null)}
        title={connectionsOf ? `Who’s connected ${connectionsOf.name}` : ''}
        size="lg"
      >
        {connections.isPending ? (
          <InlineLoading />
        ) : connections.isError ? (
          <Alert color="red">{apiErrorMessage(connections.error)}</Alert>
        ) : (
          <ConnectedAppsList
            connections={connections.data}
            show="user"
            emptyMessage="Nobody has connected this app."
            disconnectingId={disconnect.isPending ? disconnect.variables?.connectionId : undefined}
            onDisconnect={(connection) =>
              confirmDisconnect({
                connection,
                yours: false,
                onConfirm: () =>
                  disconnect.mutate({
                    applicationId: connection.application.id,
                    userId: connection.user.id,
                    connectionId: connection.id,
                  }),
              })
            }
          />
        )}
      </Modal>
    </Container>
  );
}

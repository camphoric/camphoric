/**
 * The registered apps (SPEC §8.10; §15 DR-146), one box per app (DR-49): its
 * name, client id, redirect URIs and how many people have it connected, with a
 * menu of what an Admin can do to it.
 */

import { ActionIcon, Badge, Code, Group, Menu, Paper, Stack, Text } from '@mantine/core';
import {
  IconDots,
  IconInfoCircle,
  IconKey,
  IconPencil,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import type { ApiApplication } from 'api-types';

export interface AppActions {
  onShowSetup: (app: ApiApplication) => void;
  onEdit: (app: ApiApplication) => void;
  onShowConnections: (app: ApiApplication) => void;
  onNewSecret: (app: ApiApplication) => void;
  onDelete: (app: ApiApplication) => void;
}

interface AppsTableProps extends AppActions {
  apps: ApiApplication[];
}

export function connectedLabel(count: number) {
  return count === 1 ? '1 person connected' : `${count} people connected`;
}

export function AppsTable({ apps, ...actions }: AppsTableProps) {
  if (apps.length === 0) {
    return <Text c="dimmed">No apps are registered.</Text>;
  }
  return (
    <Stack gap="sm">
      {apps.map((app) => (
        <Paper key={app.id} withBorder p="md" radius="md">
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <Stack gap={6} miw={0}>
              <Group gap="xs">
                <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
                  {app.name}
                </Text>
                <Badge variant="light" color={app.connected_users ? 'blue' : 'gray'}>
                  {connectedLabel(app.connected_users)}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                Client ID <Code>{app.client_id}</Code>
              </Text>
              <Stack gap={2}>
                {app.redirect_uris.map((uri) => (
                  <Text key={uri} size="xs" ff="monospace" style={{ overflowWrap: 'anywhere' }}>
                    {uri}
                  </Text>
                ))}
              </Stack>
            </Stack>
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" aria-label={`Actions for ${app.name}`}>
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconUsers size={16} />}
                  onClick={() => actions.onShowConnections(app)}
                >
                  Who’s connected
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconInfoCircle size={16} />}
                  onClick={() => actions.onShowSetup(app)}
                >
                  Setup details
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconPencil size={16} />}
                  onClick={() => actions.onEdit(app)}
                >
                  Edit
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconKey size={16} />}
                  onClick={() => actions.onNewSecret(app)}
                >
                  New secret
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => actions.onDelete(app)}
                >
                  Remove
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}

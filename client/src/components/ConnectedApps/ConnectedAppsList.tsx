/**
 * Apps connected to accounts (SPEC §6, §8.10; §15 DR-146, DR-149), one box per
 * connection (DR-49): the app (in a person's list) or the person (in an app's),
 * what it may do, when it was approved and last used, and — where the viewer
 * may — a button to disconnect it, which ends its access at once.
 */

import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core';
import type { ApiConnectedApp, OAuthScope } from 'api-types';

export const SCOPE_LABEL: Record<OAuthScope, string> = {
  read: 'Read',
  write: 'Change',
};

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

interface ConnectedAppsListProps {
  connections: ApiConnectedApp[];
  /** What each box is named for: the app (a person's list) or the person (an app's). */
  show: 'application' | 'user';
  /** Left out, there's no Disconnect button. */
  onDisconnect?: (connection: ApiConnectedApp) => void;
  /** The connection being disconnected, whose button shows it's busy. */
  disconnectingId?: number;
  /** What to say when there are none. */
  emptyMessage: string;
}

export function ConnectedAppsList({
  connections,
  show,
  onDisconnect,
  disconnectingId,
  emptyMessage,
}: ConnectedAppsListProps) {
  if (connections.length === 0) return <Text c="dimmed">{emptyMessage}</Text>;
  return (
    <Stack gap="sm">
      {connections.map((connection) => {
        const name =
          show === 'application'
            ? connection.application.name
            : `${connection.user.name} (${connection.user.username})`;
        return (
          <Paper key={connection.id} withBorder p="sm" radius="md">
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Stack gap={4} miw={0}>
                <Text fw={500} style={{ overflowWrap: 'anywhere' }}>
                  {name}
                </Text>
                <Group gap={4}>
                  {connection.scopes.map((scope) => (
                    <Badge
                      key={scope}
                      variant="light"
                      color={scope === 'write' ? 'orange' : 'blue'}
                    >
                      {SCOPE_LABEL[scope]}
                    </Badge>
                  ))}
                </Group>
                <Text size="xs" c="dimmed">
                  Approved {formatTime(connection.approved_at)} · last used{' '}
                  {connection.last_used_at ? formatTime(connection.last_used_at) : 'never'}
                </Text>
              </Stack>
              {onDisconnect && (
                <Button
                  variant="light"
                  color="red"
                  size="xs"
                  loading={disconnectingId === connection.id}
                  onClick={() => onDisconnect(connection)}
                  aria-label={`Disconnect ${name}`}
                >
                  Disconnect
                </Button>
              )}
            </Group>
          </Paper>
        );
      })}
    </Stack>
  );
}

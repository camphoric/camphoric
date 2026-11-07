/**
 * Personal access tokens (SPEC §6; #965), one box per token: its name, its
 * prefix (the token itself is never shown again after it's made), whether it
 * may only read, when and where it was made (from the account, or on the
 * server), when it expires and when it was last used, and — where the viewer
 * may — a button to revoke it.
 */

import { Badge, Button, Code, Group, Paper, Stack, Text } from '@mantine/core';
import type { ApiToken } from 'api-types';

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

export const CREATED_VIA_LABEL: Record<ApiToken['created_via'], string> = {
  account: 'from the account',
  command: 'on the server',
};

interface ApiTokenListProps {
  tokens: ApiToken[];
  /** Left out, there's no Revoke button. */
  onRevoke?: (token: ApiToken) => void;
  /** The token being revoked, whose button shows it's busy. */
  revokingId?: number;
  /** What to say when there are none. */
  emptyMessage: string;
}

export function ApiTokenList({ tokens, onRevoke, revokingId, emptyMessage }: ApiTokenListProps) {
  if (tokens.length === 0) return <Text c="dimmed">{emptyMessage}</Text>;
  return (
    <Stack gap="sm">
      {tokens.map((token) => (
        <Paper key={token.id} withBorder p="sm" radius="md">
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <Stack gap={4} miw={0} style={{ flex: 1 }}>
              <Group gap="xs">
                <Text fw={500} style={{ overflowWrap: 'anywhere' }}>
                  {token.name}
                </Text>
                {token.read_only && (
                  <Badge variant="light" color="blue">
                    Read-only
                  </Badge>
                )}
              </Group>
              <Code style={{ alignSelf: 'flex-start', overflowWrap: 'anywhere' }}>
                {token.prefix}…
              </Code>
              <Text size="xs" c="dimmed">
                Made {formatTime(token.created_at)} {CREATED_VIA_LABEL[token.created_via]} · expires{' '}
                {token.expires_at ? formatTime(token.expires_at) : 'never'} · last used{' '}
                {token.last_used_at ? formatTime(token.last_used_at) : 'never'}
              </Text>
            </Stack>
            {onRevoke && (
              <Button
                variant="light"
                color="red"
                size="xs"
                // Its label stays whole however much the details wrap.
                style={{ flexShrink: 0 }}
                loading={revokingId === token.id}
                onClick={() => onRevoke(token)}
                // Two tokens may share a name; their prefixes tell them apart.
                aria-label={`Revoke ${token.name} (${token.prefix})`}
              >
                Revoke
              </Button>
            )}
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}

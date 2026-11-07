/**
 * A personal access token just made (SPEC §6; #965): the whole token, shown
 * this once with a way to copy it, how a script sends it, and that it won't be
 * shown again.
 */

import { Alert, Button, Code, CopyButton, Group, Stack, Text, TextInput } from '@mantine/core';
import type { ApiNewToken } from 'api-types';

interface NewTokenSecretProps {
  token: ApiNewToken;
  onDone: () => void;
}

export function NewTokenSecret({ token, onDone }: NewTokenSecretProps) {
  return (
    <Stack>
      <Alert color="yellow" variant="light" title="Copy it now">
        This is the only time you’ll see this token. Keep it somewhere safe, such as your script’s
        secrets; if it’s lost, revoke it and make another.
      </Alert>
      <Group wrap="nowrap" gap="xs" align="flex-end">
        <TextInput
          label={token.name}
          value={token.token}
          readOnly
          style={{ flex: 1 }}
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
          onFocus={(e) => e.currentTarget.select()}
        />
        <CopyButton value={token.token}>
          {({ copied, copy }) => (
            <Button variant="light" onClick={copy} aria-label="Copy the token">
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
        </CopyButton>
      </Group>
      <Text size="sm" c="dimmed">
        A script sends it as <Code>Authorization: Bearer {token.prefix}…</Code>
        {token.read_only ? ', and may only read with it.' : '.'}
      </Text>
      <Group justify="flex-end">
        <Button onClick={onDone}>Done</Button>
      </Group>
    </Stack>
  );
}

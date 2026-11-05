/**
 * The OAuth consent screen (SPEC §6; §15 DR-150, DR-152): which app is asking, who
 * is signed in (with their permission group, and a way to sign in as someone
 * else), what the app asks to do, and Cancel or Connect. Shown every time an app
 * asks; nothing is chosen for the person.
 */

import { Alert, Anchor, Button, Group, List, Stack, Text, Title } from '@mantine/core';
import type { ApiOAuthRequest, ApiUser } from 'api-types';
import { ROLE_LABEL } from 'hooks/permissions';

interface ConsentFormProps {
  request: ApiOAuthRequest;
  user: ApiUser;
  /** Connecting or cancelling failed. */
  error?: string | null;
  connecting?: boolean;
  cancelling?: boolean;
  onConnect: () => void;
  onCancel: () => void;
  onSwitchAccount: () => void;
}

export function ConsentForm({
  request,
  user,
  error,
  connecting = false,
  cancelling = false,
  onConnect,
  onCancel,
  onSwitchAccount,
}: ConsentFormProps) {
  const appName = request.application.name;
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const roleName = user.role ? ROLE_LABEL[user.role] : null;
  return (
    <Stack>
      <Title order={3} style={{ overflowWrap: 'anywhere' }}>
        Connect {appName} to your Camphoric account?
      </Title>
      <Group gap="xs" wrap="wrap" align="baseline">
        <Text size="sm">
          Signed in as{' '}
          {fullName ? (
            <>
              <strong>{fullName}</strong> ({user.username})
            </>
          ) : (
            <strong>{user.username}</strong>
          )}
          {roleName ? `, ${roleName}` : ''}.
        </Text>
        <Anchor component="button" type="button" size="sm" onClick={onSwitchAccount}>
          Not you? Sign in as someone else
        </Anchor>
      </Group>
      <div>
        <Text size="sm">
          <strong>{appName}</strong> is asking to:
        </Text>
        <List size="sm" mt={4}>
          {request.scopes.map((scope) => (
            <List.Item key={scope.name}>{scope.description}</List.Item>
          ))}
        </List>
      </div>
      {request.write_limited_by_role && roleName && (
        <Text size="sm">
          As a {roleName} you can’t change anything in Camphoric, so neither can it.
        </Text>
      )}
      <Text size="sm" c="dimmed">
        It acts as you, and can never do more than your Camphoric permission group allows. You can
        disconnect it at any time from <strong>Connected apps</strong> in your Camphoric user menu.
      </Text>
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel} loading={cancelling} disabled={connecting}>
          Cancel
        </Button>
        <Button onClick={onConnect} loading={connecting} disabled={cancelling}>
          Connect
        </Button>
      </Group>
    </Stack>
  );
}

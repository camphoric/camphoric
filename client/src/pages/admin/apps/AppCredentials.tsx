/**
 * What an app's developer needs to set it up (SPEC §8.10; §15 DR-146): its
 * client id and — right after it's registered or given a new secret, and never
 * again — its secret, with the server's authorization, token and revocation
 * endpoints and the scopes it may ask for.
 */

import { Alert, Button, CopyButton, Group, Stack, Text, TextInput } from '@mantine/core';

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <Group wrap="nowrap" gap="xs" align="flex-end">
      <TextInput
        label={label}
        value={value}
        readOnly
        style={{ flex: 1 }}
        styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
      />
      <CopyButton value={value}>
        {({ copied, copy }) => (
          <Button variant="light" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
      </CopyButton>
    </Group>
  );
}

interface AppCredentialsProps {
  clientId: string;
  /** Shown only right after it's made. */
  clientSecret?: string;
  /** The server's address, e.g. `https://camp.example.org`. */
  origin: string;
}

export function AppCredentials({ clientId, clientSecret, origin }: AppCredentialsProps) {
  return (
    <Stack gap="sm">
      {clientSecret && (
        <Alert color="yellow" variant="light">
          Copy the secret now and give it to whoever runs the app: it isn’t shown again. If it’s
          lost, give the app a new one.
        </Alert>
      )}
      <CopyField label="Client ID" value={clientId} />
      {clientSecret && <CopyField label="Client secret" value={clientSecret} />}
      <CopyField label="Authorization URL" value={`${origin}/o/authorize/`} />
      <CopyField label="Token URL" value={`${origin}/o/token/`} />
      <CopyField label="Revocation URL" value={`${origin}/o/revoke_token/`} />
      <Text size="sm" c="dimmed">
        The app uses the authorization code grant with PKCE (S256), and asks for the scopes{' '}
        <code>read</code> and, to change anything, <code>write</code>. It sends its access token as{' '}
        <code>Authorization: Bearer …</code>; an access token lasts an hour, and each refresh gives
        a new refresh token.
      </Text>
    </Stack>
  );
}

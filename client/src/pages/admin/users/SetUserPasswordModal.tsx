/**
 * Superusers: set someone's password (SPEC §8.10; §15 DR-52), by default to be
 * changed at their next sign-in. It signs them out everywhere.
 */

import { Alert, Button, Checkbox, Group, Modal, PasswordInput, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { apiErrorMessage, apiFieldErrors } from 'utils/fetch';

interface SetUserPasswordModalProps {
  /** The user whose password is being set; null when closed. */
  username: string | null;
  saving?: boolean;
  error?: unknown;
  onSubmit: (password: string, requireChange: boolean) => void;
  onClose: () => void;
}

export function SetUserPasswordModal({
  username,
  saving,
  error,
  onSubmit,
  onClose,
}: SetUserPasswordModalProps) {
  return (
    <Modal opened={username !== null} onClose={onClose} title={`Set ${username ?? ''}’s password`}>
      {username !== null && (
        <SetUserPasswordForm saving={saving} error={error} onSubmit={onSubmit} onClose={onClose} />
      )}
    </Modal>
  );
}

function SetUserPasswordForm({
  saving,
  error,
  onSubmit,
  onClose,
}: Omit<SetUserPasswordModalProps, 'username'>) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [requireChange, setRequireChange] = useState(true);
  const fieldError = apiFieldErrors(error).password;
  const otherError = error && !fieldError ? apiErrorMessage(error) : null;
  const mismatch = again !== '' && again !== password;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(password, requireChange);
      }}
    >
      <Stack>
        <Text size="sm">They’ll be signed out everywhere and need this password to sign in.</Text>
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          error={fieldError}
        />
        <PasswordInput
          label="New password again"
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.currentTarget.value)}
          error={mismatch ? 'The passwords don’t match.' : undefined}
        />
        <Checkbox
          label="Require a password change at next sign-in"
          checked={requireChange}
          onChange={(e) => setRequireChange(e.currentTarget.checked)}
        />
        {otherError && (
          <Alert color="red" variant="light">
            {otherError}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!password || password !== again} loading={saving}>
            Set password
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

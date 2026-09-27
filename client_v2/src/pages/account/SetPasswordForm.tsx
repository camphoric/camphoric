/**
 * Choose a password (SPEC §6; §15 DR-52): the new password twice, for the
 * account a set-password link is for. The server's password rules are shown
 * under the field.
 */

import { Button, PasswordInput, Stack, Text } from '@mantine/core';
import { useState } from 'react';

interface SetPasswordFormProps {
  username: string;
  onSubmit: (password: string) => void;
  /** The server's objection to the password, if any. */
  error?: string;
  saving?: boolean;
}

export function SetPasswordForm({ username, onSubmit, error, saving }: SetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const mismatch = again !== '' && again !== password;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(password);
      }}
    >
      <Stack>
        <Text>
          Choose a password for <b>{username}</b>.
        </Text>
        {/* Lets password managers save it under the right account. */}
        <input type="hidden" name="username" autoComplete="username" value={username} />
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          error={error}
        />
        <PasswordInput
          label="New password again"
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.currentTarget.value)}
          error={mismatch ? 'The passwords don’t match.' : undefined}
        />
        <Button type="submit" disabled={!password || password !== again} loading={saving}>
          Set password
        </Button>
      </Stack>
    </form>
  );
}

/**
 * Ask for a link to choose a new password (SPEC §6; §15 DR-52). The answer is
 * the same whether or not the address has an account.
 */

import { Alert, Button, Stack, Text, TextInput } from '@mantine/core';
import { useRequestPasswordReset } from 'hooks/auth';
import { useState } from 'react';
import { apiErrorMessage } from 'utils/fetch';

export function ForgotPasswordForm({ onBack }: { onBack?: () => void }) {
  const request = useRequestPasswordReset();
  const [email, setEmail] = useState('');

  if (request.isSuccess) {
    return (
      <Stack>
        <Alert color="green" variant="light">
          {request.data.detail}
        </Alert>
        {onBack && (
          <Button variant="default" onClick={onBack}>
            Back to sign in
          </Button>
        )}
      </Stack>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        request.mutate(email.trim());
      }}
    >
      <Stack>
        <Text size="sm">
          Enter your account’s email address and we’ll send you a link to choose a new password.
        </Text>
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
        />
        {request.isError && (
          <Alert color="red" variant="light">
            {apiErrorMessage(request.error)}
          </Alert>
        )}
        <Button type="submit" disabled={!email.trim()} loading={request.isPending}>
          Email me a link
        </Button>
        {onBack && (
          <Button variant="subtle" onClick={onBack}>
            Back to sign in
          </Button>
        )}
      </Stack>
    </form>
  );
}

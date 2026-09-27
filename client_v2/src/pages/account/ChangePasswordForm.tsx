/**
 * Change your own password (SPEC §6; §15 DR-52): the current one, then the new
 * one twice. The server's password rules are shown under the field they're
 * about. Used from the user menu and on the forced "choose a new password"
 * screen.
 */

import { Alert, Button, Group, PasswordInput, Stack } from '@mantine/core';
import { useChangePassword } from 'hooks/auth';
import { useState } from 'react';
import { apiErrorMessage, apiFieldErrors } from 'utils/fetch';

interface ChangePasswordFormProps {
  onDone: () => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export function ChangePasswordForm({
  onDone,
  onCancel,
  submitLabel = 'Change password',
}: ChangePasswordFormProps) {
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const mismatch = again !== '' && again !== next;
  const errors = apiFieldErrors(change.error);
  const otherError = change.error && !Object.keys(errors).length ? change.error : null;

  const submit = () =>
    change.mutate({ current_password: current, new_password: next }, { onSuccess: onDone });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Stack>
        <PasswordInput
          label="Current password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.currentTarget.value)}
          error={errors.current_password}
        />
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.currentTarget.value)}
          error={errors.new_password}
        />
        <PasswordInput
          label="New password again"
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.currentTarget.value)}
          error={mismatch ? 'The passwords don’t match.' : undefined}
        />
        {otherError && (
          <Alert color="red" variant="light">
            {apiErrorMessage(otherError)}
          </Alert>
        )}
        <Group justify="flex-end">
          {onCancel && (
            <Button variant="default" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={!current || !next || next !== again}
            loading={change.isPending}
          >
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

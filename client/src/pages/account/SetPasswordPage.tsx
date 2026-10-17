/**
 * The page a set-password link opens (SPEC §4, §6; §15 DR-52):
 * /account/set-password/:uid/:token. It checks the link, lets the person choose
 * a password, then sends them to sign in. A used or expired link offers to
 * email a new one. Public: it's reached before the person can sign in.
 */

import { Alert, Anchor, Button, Card, Center, Stack, Title } from '@mantine/core';
import { Link, useParams } from '@tanstack/react-router';
import { InlineLoading } from 'components/Loading';
import { usePasswordResetCheck, useSetPasswordWithToken } from 'hooks/auth';
import { ForgotPasswordForm } from 'navigation/Login/ForgotPasswordForm';
import { useState } from 'react';
import { apiErrorMessage, apiFieldErrors } from 'utils/fetch';

import { SetPasswordForm } from './SetPasswordForm';

export function SetPasswordPage() {
  const { uid, token } = useParams({ from: '/account/set-password/$uid/$token' });
  const check = usePasswordResetCheck(uid, token);
  const save = useSetPasswordWithToken(uid, token);
  const [requestNew, setRequestNew] = useState(false);
  const fieldErrors = apiFieldErrors(save.error);

  let body;
  if (check.isLoading) {
    body = <InlineLoading message="Checking your link…" />;
  } else if (save.isSuccess) {
    body = (
      <Stack>
        <Alert color="green" variant="light">
          Your password is set. Sign in with it now.
        </Alert>
        <Button component={Link} to="/admin">
          Sign in
        </Button>
      </Stack>
    );
  } else if (check.isError || (save.isError && !Object.keys(fieldErrors).length)) {
    body = requestNew ? (
      <ForgotPasswordForm />
    ) : (
      <Stack>
        <Alert color="yellow" variant="light">
          {check.isError
            ? 'This link has expired or has already been used.'
            : apiErrorMessage(save.error)}
        </Alert>
        <Button variant="default" onClick={() => setRequestNew(true)}>
          Email me a new link
        </Button>
      </Stack>
    );
  } else {
    body = (
      <SetPasswordForm
        username={check.data?.username ?? ''}
        onSubmit={(password) => save.mutate(password)}
        error={fieldErrors.new_password}
        saving={save.isPending}
      />
    );
  }

  return (
    <Center mih="100vh" px="md">
      <Card withBorder shadow="sm" radius="md" w={400} maw="100%" p="lg">
        <Stack>
          <Title order={3}>Choose your password</Title>
          {body}
          <Anchor component={Link} to="/admin" size="sm">
            Go to sign in
          </Anchor>
        </Stack>
      </Card>
    </Center>
  );
}

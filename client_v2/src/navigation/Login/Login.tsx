/**
 * Admin login form (SPEC §6). Posts username/password to /api/login; on success
 * the whoami cache is invalidated and the guarded content renders. "Forgot
 * password?" switches to asking for a set-password link (DR-52).
 */

import {
  Alert,
  Anchor,
  Button,
  Card,
  Center,
  PasswordInput,
  Stack,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useLogin } from 'hooks/auth';
import { useState } from 'react';
import { ApiError } from 'utils/fetch';

import { ForgotPasswordForm } from './ForgotPasswordForm';

/** A 401/400 means bad credentials; anything else (403 CSRF, network, 500) is a
 * different failure and shouldn't be reported as "invalid credentials". */
function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError && (error.status === 401 || error.status === 400)) {
    return 'Invalid username or password.';
  }
  return 'Sign-in failed. Please try again.';
}

export function Login() {
  const [forgot, setForgot] = useState(false);
  const login = useLogin();
  const form = useForm({
    initialValues: { username: '', password: '' },
    validate: {
      username: (value) => (value.trim() ? null : 'Username is required'),
      password: (value) => (value ? null : 'Password is required'),
    },
  });

  const handleSubmit = form.onSubmit((values) => login.mutate(values));

  if (forgot) {
    return (
      <Center h="100vh" px="md">
        <Card withBorder shadow="sm" radius="md" w={360} p="lg">
          <Stack>
            <Title order={3}>Forgot your password?</Title>
            <ForgotPasswordForm onBack={() => setForgot(false)} />
          </Stack>
        </Card>
      </Center>
    );
  }

  return (
    <Center h="100vh" px="md">
      <Card withBorder shadow="sm" radius="md" w={360} p="lg">
        <form onSubmit={handleSubmit}>
          <Stack>
            <Title order={3}>Admin sign in</Title>
            {login.isError ? (
              <Alert color="red" variant="light">
                {loginErrorMessage(login.error)}
              </Alert>
            ) : null}
            <TextInput
              label="Username"
              autoComplete="username"
              {...form.getInputProps('username')}
            />
            <PasswordInput
              label="Password"
              autoComplete="current-password"
              {...form.getInputProps('password')}
            />
            <Button type="submit" loading={login.isPending} fullWidth>
              Sign in
            </Button>
            <Anchor component="button" type="button" size="sm" onClick={() => setForgot(true)}>
              Forgot password?
            </Anchor>
          </Stack>
        </form>
      </Card>
    </Center>
  );
}

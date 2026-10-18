/**
 * Admin login form (SPEC §6). Posts username/password to /api/login; on success
 * the response becomes the current user (useLogin) and the guarded content
 * renders. "Forgot password?" switches to asking for a set-password link (DR-52).
 * The sign-in fields are shared with the prompt to sign in again over the admin
 * (`SignInAgain`, DR-127).
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
import { type ReactNode, useState } from 'react';
import { ApiError } from 'utils/fetch';

import { ForgotPasswordForm } from './ForgotPasswordForm';

/** How long to wait, from a Retry-After in seconds: "in 45 seconds", "in 3 minutes". */
function waitFor(seconds: number | null): string {
  if (seconds === null) return 'later';
  if (seconds < 90) {
    const whole = Math.max(1, Math.ceil(seconds));
    return `in ${whole} second${whole === 1 ? '' : 's'}`;
  }
  return `in ${Math.ceil(seconds / 60)} minutes`;
}

/** A 401/400 means bad credentials, and a 429 too many attempts (the server
 * throttles sign-in, DR-124); anything else (403 CSRF, network, 500) is a
 * different failure and shouldn't be reported as "invalid credentials". */
function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError && (error.status === 401 || error.status === 400)) {
    return 'Invalid username or password.';
  }
  if (error instanceof ApiError && error.status === 429) {
    return `Too many sign-in attempts. Try again ${waitFor(error.retryAfter)}.`;
  }
  return 'Sign-in failed. Please try again.';
}

interface SignInFormProps {
  /** Shown above the fields. */
  intro: ReactNode;
  /** Filled in to start with; the password then takes the focus in a dialog. */
  username?: string;
  onForgot: () => void;
}

/** The username and password, and the way to "Forgot password?". */
export function SignInForm({ intro, username = '', onForgot }: SignInFormProps) {
  const login = useLogin();
  const form = useForm({
    initialValues: { username, password: '' },
    validate: {
      username: (value) => (value.trim() ? null : 'Username is required'),
      password: (value) => (value ? null : 'Password is required'),
    },
  });

  const handleSubmit = form.onSubmit((values) => login.mutate(values));

  return (
    <form onSubmit={handleSubmit}>
      <Stack>
        {intro}
        {login.isError ? (
          <Alert color="red" variant="light">
            {loginErrorMessage(login.error)}
          </Alert>
        ) : null}
        <TextInput label="Username" autoComplete="username" {...form.getInputProps('username')} />
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          data-autofocus={username ? true : undefined}
          {...form.getInputProps('password')}
        />
        <Button type="submit" loading={login.isPending} fullWidth>
          Sign in
        </Button>
        <Anchor component="button" type="button" size="sm" onClick={onForgot}>
          Forgot password?
        </Anchor>
      </Stack>
    </form>
  );
}

export function Login() {
  const [forgot, setForgot] = useState(false);

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
        <SignInForm
          intro={<Title order={3}>Admin sign in</Title>}
          onForgot={() => setForgot(true)}
        />
      </Card>
    </Center>
  );
}

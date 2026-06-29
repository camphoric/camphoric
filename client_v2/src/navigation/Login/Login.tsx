/**
 * Admin login form (SPEC §6). Posts username/password to /api/login; on success
 * the whoami cache is invalidated and the guarded content renders.
 */

import { Alert, Button, Card, Center, PasswordInput, Stack, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useLogin } from 'hooks/auth';

export function Login() {
  const login = useLogin();
  const form = useForm({
    initialValues: { username: '', password: '' },
    validate: {
      username: (value) => (value.trim() ? null : 'Username is required'),
      password: (value) => (value ? null : 'Password is required'),
    },
  });

  const handleSubmit = form.onSubmit((values) => login.mutate(values));

  return (
    <Center h="100vh" px="md">
      <Card withBorder shadow="sm" radius="md" w={360} p="lg">
        <form onSubmit={handleSubmit}>
          <Stack>
            <Title order={3}>Admin sign in</Title>
            {login.isError ? (
              <Alert color="red" variant="light">
                Invalid username or password.
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
          </Stack>
        </form>
      </Card>
    </Center>
  );
}

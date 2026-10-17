/**
 * Stories for the password forms (SPEC §6; §15 DR-52): choosing a
 * password from a set-password link, a password the server refuses, changing
 * your own, and the forced "choose a new password" screen. The story answers
 * the change-password request itself. Run `npm run storybook`.
 */

import { Code, Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { anonymousUser } from 'api-types';
import { MustChangePassword } from 'navigation/MustChangePassword';
import { type ReactNode, useState } from 'react';

import { ChangePasswordForm } from '../ChangePasswordForm';
import { SetPasswordForm } from '../SetPasswordForm';

const realFetch = window.fetch.bind(window);

/** Accept any change except the current password "wrong"; refuse "password" as too common. */
function stubChangePassword() {
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('/api/user/password')) return realFetch(input, init);
    const body = JSON.parse(init?.body as string) as Record<string, string>;
    const json = (data: unknown, status: number) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    if (body.current_password === 'wrong') {
      return json({ current_password: ['That isn’t your current password.'] }, 400);
    }
    if (body.new_password === 'password') {
      return json({ new_password: ['This password is too common.'] }, 400);
    }
    return new Response(null, { status: 204 });
  };
}

function WithQueries({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    stubChangePassword();
    return new QueryClient();
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export default { title: 'Password Forms' } satisfies Meta;

export const SetPassword: StoryFn = () => {
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <Stack p="md" maw={400}>
      <SetPasswordForm username="pat" onSubmit={setChosen} />
      {chosen !== null && <Code data-testid="chosen">{`${chosen.length} characters`}</Code>}
    </Stack>
  );
};

export const SetPasswordRefused: StoryFn = () => (
  <Stack p="md" maw={400}>
    <SetPasswordForm username="pat" onSubmit={() => {}} error="This password is too common." />
  </Stack>
);

export const ChangePassword: StoryFn = () => {
  const [done, setDone] = useState(false);
  return (
    <WithQueries>
      <Stack p="md" maw={400}>
        <ChangePasswordForm onDone={() => setDone(true)} onCancel={() => setDone(false)} />
        {done && <Code data-testid="done">Changed</Code>}
      </Stack>
    </WithQueries>
  );
};

export const MustChange: StoryFn = () => (
  <WithQueries>
    <MustChangePassword user={{ ...anonymousUser, id: 3, username: 'pat', is_active: true }} />
  </WithQueries>
);

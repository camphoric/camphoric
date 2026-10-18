/**
 * Stories for signing in (SPEC §6): the sign-in form, where any password is
 * wrong or, in Too Many Attempts, refused by the sign-in throttle (DR-124), and
 * "Forgot password?", whose answer is the same for any address (DR-52). The
 * stories answer the requests themselves. Run `npm run storybook`.
 */

import type { Meta, StoryFn } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { Login } from '../Login';

const realFetch = window.fetch.bind(window);

function stubAuth(login: { status: number; detail: string }) {
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    if (url.includes('/api/password-reset')) {
      return json(
        {
          detail:
            'If an account uses that address, we’ve emailed it a link to choose a new password.',
        },
        202,
      );
    }
    if (url.includes('/api/login')) {
      return new Response(JSON.stringify({ detail: login.detail }), {
        status: login.status,
        headers: {
          'Content-Type': 'application/json',
          ...(login.status === 429 ? { 'Retry-After': '60' } : {}),
        },
      });
    }
    return realFetch(input, init);
  };
}

export default { title: 'Login' } satisfies Meta;

function LoginStory({ login }: { login: { status: number; detail: string } }) {
  const [client] = useState(() => {
    stubAuth(login);
    return new QueryClient();
  });
  return (
    <QueryClientProvider client={client}>
      <Login />
    </QueryClientProvider>
  );
}

export const SignIn: StoryFn = () => <LoginStory login={{ status: 400, detail: 'Login failed' }} />;

export const TooManyAttempts: StoryFn = () => (
  <LoginStory
    login={{ status: 429, detail: 'Request was throttled. Expected available in 60 seconds.' }}
  />
);

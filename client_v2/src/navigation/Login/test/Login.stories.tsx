/**
 * Ladle stories for signing in (SPEC §6): the sign-in form, and "Forgot
 * password?", whose answer is the same for any address (DR-52). The story
 * answers the requests itself. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { Login } from '../Login';

const realFetch = window.fetch.bind(window);

function stubAuth() {
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
    if (url.includes('/api/login')) return json({ detail: 'Login failed' }, 400);
    return realFetch(input, init);
  };
}

export const SignIn: Story = () => {
  const [client] = useState(() => {
    stubAuth();
    return new QueryClient();
  });
  return (
    <QueryClientProvider client={client}>
      <Login />
    </QueryClientProvider>
  );
};

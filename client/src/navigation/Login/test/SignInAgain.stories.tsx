/**
 * Stories for signing in again over the admin after the session ended (SPEC §6;
 * §15 DR-127): the admin, and any dialog it had open, stay put underneath, out
 * of reach. The stories refuse the sign-in themselves. Run `npm run storybook`.
 */

import { Modal, Stack, Textarea, TextInput, Title } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import { SignInAgain } from '../SignInAgain';

const realFetch = window.fetch.bind(window);

function stubAuth() {
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/login')) {
      return new Response(JSON.stringify({ detail: 'Login failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input, init);
  };
}

function WithClient({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    stubAuth();
    return new QueryClient();
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export default { title: 'Sign In Again' } satisfies Meta;

/** The session ended under an editor. */
export const OverTheAdmin: StoryFn = () => (
  <WithClient>
    <Stack p="md">
      <Title order={3}>Lark Camp 2026 — Settings</Title>
      <Textarea label="Welcome message" defaultValue="Half-written, not yet saved…" />
    </Stack>
    <SignInAgain username="pat" />
  </WithClient>
);

/** The session ended with a dialog open: Escape and Tab can't reach it. */
export const OverAnOpenDialog: StoryFn = () => {
  const [open, setOpen] = useState(true);
  return (
    <WithClient>
      <Modal opened={open} onClose={() => setOpen(false)} title="Edit camper">
        <TextInput label="Camper note" defaultValue="Half-written, not yet saved…" />
      </Modal>
      {open ? null : <p data-testid="closed">The dialog underneath closed.</p>}
      <SignInAgain username="pat" />
    </WithClient>
  );
};

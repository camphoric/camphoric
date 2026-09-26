/**
 * Ladle stories for the event's unsubscribed addresses (SPEC §8.9): a list with
 * both kinds of entry, and an empty one. The story keeps the list itself, so
 * adding and removing work without a backend. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiEmailUnsubscribe } from 'api-types';
import { useState } from 'react';

import { EmailUnsubscribes } from '../EmailUnsubscribes';

const realFetch = window.fetch.bind(window);

function stubList(initial: ApiEmailUnsubscribe[]) {
  let rows = [...initial];
  let nextId = 100;
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('/api/emailunsubscribes/')) return realFetch(input, init);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'POST') {
      const { email } = JSON.parse(init?.body as string) as { email: string };
      const address = email.trim().toLowerCase();
      if (rows.some((r) => r.email === address)) {
        return json({ email: ['This address is already unsubscribed.'] }, 400);
      }
      const row: ApiEmailUnsubscribe = {
        id: nextId++,
        event: 7,
        email: address,
        source: 'admin',
        created_by: 1,
        created_by_name: 'you',
        created_at: new Date().toISOString(),
      };
      rows = [row, ...rows];
      return json(row, 201);
    }
    if (method === 'DELETE') {
      const id = Number(url.split('/').filter(Boolean).pop());
      rows = rows.filter((r) => r.id !== id);
      return new Response(null, { status: 204 });
    }
    return json(rows);
  };
}

function Harness({ rows }: { rows: ApiEmailUnsubscribe[] }) {
  const [client] = useState(() => {
    stubList(rows);
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  return (
    <QueryClientProvider client={client}>
      <ModalsProvider>
        <div style={{ maxWidth: 900, padding: 16 }}>
          <EmailUnsubscribes eventId={7} />
        </div>
      </ModalsProvider>
    </QueryClientProvider>
  );
}

export const List: Story = () => (
  <Harness
    rows={[
      {
        id: 1,
        event: 7,
        email: 'pat@example.com',
        source: 'link',
        created_by: null,
        created_by_name: null,
        created_at: '2026-09-20T15:00:00Z',
      },
      {
        id: 2,
        event: 7,
        email: 'kim@example.com',
        source: 'admin',
        created_by: 1,
        created_by_name: 'will',
        created_at: '2026-09-18T10:30:00Z',
      },
    ]}
  />
);

export const Empty: Story = () => <Harness rows={[]} />;

/**
 * Stories for the addresses unsubscribed from an organization's email to past
 * campers (SPEC §8.12): a list with both kinds of entry, and an empty one. The
 * story keeps the list itself, so adding and removing work without a backend.
 * Run `npm run storybook`.
 */

import { ModalsProvider } from '@mantine/modals';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiOrganizationUnsubscribe } from 'api-types';
import { useState } from 'react';

import { OrganizationUnsubscribes } from '../OrganizationUnsubscribes';
import { UNSUBSCRIBED } from './fixtures';

const realFetch = window.fetch.bind(window);

function stubList(initial: ApiOrganizationUnsubscribe[]) {
  let rows = [...initial];
  let nextId = 100;
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('/api/organization-unsubscribes/')) return realFetch(input, init);
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
      const row: ApiOrganizationUnsubscribe = {
        id: nextId++,
        organization: 1,
        email: address,
        source: 'admin',
        created_by: 1,
        created_by_name: 'you',
        created_at: new Date().toISOString(),
        version: 1,
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

function Harness({ rows }: { rows: ApiOrganizationUnsubscribe[] }) {
  const [client] = useState(() => {
    stubList(rows);
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  return (
    <QueryClientProvider client={client}>
      <ModalsProvider>
        <div style={{ maxWidth: 900, padding: 16 }}>
          <OrganizationUnsubscribes organizationId={1} />
        </div>
      </ModalsProvider>
    </QueryClientProvider>
  );
}

export default { title: 'Organization Unsubscribes' } satisfies Meta;

export const List: StoryFn = () => <Harness rows={UNSUBSCRIBED} />;
export const Empty: StoryFn = () => <Harness rows={[]} />;

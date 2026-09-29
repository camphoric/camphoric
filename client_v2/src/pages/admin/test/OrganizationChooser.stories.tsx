/**
 * Stories for the organization chooser (SPEC §8.1): an Admin's, who can
 * add, rename and delete organizations, and a Registrar's. The story keeps the
 * organizations itself (one with events can't be deleted) and runs in a small
 * in-memory router. Run `npm run storybook`.
 */

import { ModalsProvider } from '@mantine/modals';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import type { ApiOrganization, Role } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { useState } from 'react';

import { OrganizationChooser } from '../OrganizationChooser';

const realFetch = window.fetch.bind(window);

function stubOrganizations() {
  let organizations: ApiOrganization[] = [
    { id: 1, name: 'Lark Traditional Arts', created_at: '', updated_at: '' },
    { id: 2, name: 'Camp Harmony', created_at: '', updated_at: '' },
  ];
  let nextId = 10;
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('/api/organizations/')) return realFetch(input, init);
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    const method = (init?.method ?? 'GET').toUpperCase();
    const id = Number(url.split('/').filter(Boolean).pop());
    if (method === 'POST') {
      const { name } = JSON.parse(init?.body as string) as { name: string };
      const created = { id: nextId++, name, created_at: '', updated_at: '' };
      organizations = [...organizations, created];
      return json(created, 201);
    }
    if (method === 'PATCH') {
      const { name } = JSON.parse(init?.body as string) as { name: string };
      organizations = organizations.map((o) => (o.id === id ? { ...o, name } : o));
      return json(organizations.find((o) => o.id === id));
    }
    if (method === 'DELETE') {
      if (id === 1) {
        return json({ detail: 'This organization still has events, so it can’t be deleted.' }, 409);
      }
      organizations = organizations.filter((o) => o.id !== id);
      return new Response(null, { status: 204 });
    }
    return json(organizations);
  };
}

function Chooser({ userRole }: { userRole: Role }) {
  const [state] = useState(() => {
    stubOrganizations();
    const rootRoute = createRootRoute({
      component: () => (
        <PermissionsProvider userRole={userRole}>
          <OrganizationChooser />
        </PermissionsProvider>
      ),
    });
    return {
      client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      router: createRouter({
        routeTree: rootRoute,
        history: createMemoryHistory({ initialEntries: ['/'] }),
      }),
    };
  });
  return (
    <QueryClientProvider client={state.client}>
      <ModalsProvider>
        <RouterProvider router={state.router} />
      </ModalsProvider>
    </QueryClientProvider>
  );
}

export default { title: 'Organization Chooser' } satisfies Meta;

export const AsAdmin: StoryFn = () => <Chooser userRole="admin" />;
export const AsRegistrar: StoryFn = () => <Chooser userRole="registrar" />;

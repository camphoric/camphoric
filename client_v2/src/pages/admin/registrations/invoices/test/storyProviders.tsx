/**
 * For the invoice dialogs' stories: a query client, Mantine's modals, and a
 * stand-in API that accepts any write and echoes it, so no backend is needed.
 */

import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

const realFetch = window.fetch.bind(window);

function stubApi() {
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/')) {
      const body = init?.body ? (JSON.parse(init.body as string) as object) : {};
      return new Response(JSON.stringify({ id: 99, ...body }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input, init);
  };
}

export function StoryProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    stubApi();
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  return (
    <QueryClientProvider client={client}>
      <ModalsProvider>
        <Notifications />
        {children}
      </ModalsProvider>
    </QueryClientProvider>
  );
}

/**
 * Ladle stories for sending a group email (SPEC §8.9): review the recipients
 * (one already got it), choose more with an ad-hoc filter, pick the sender and
 * when, send a test, and confirm. The story answers the API itself
 * (stubEmailApi) and shows what it would have posted. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Code, Stack } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiEvent } from 'api-types';
import { useState } from 'react';

import { SendDialog } from '../SendDialog';
import { sampleTemplate } from './emailFixtures';
import { stubEmailApi } from './stubEmailApi';

const event = {
  id: 7,
  organization: 1,
  confirmation_email_from: 'registration@camp.org',
} as ApiEvent;

export const Send: Story = () => {
  const [posted, setPosted] = useState<{ url: string; body: unknown } | null>(null);
  const [client] = useState(() => {
    stubEmailApi((url, body) => setPosted({ url, body }));
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  return (
    <QueryClientProvider client={client}>
      <ModalsProvider>
        <Stack p="md" maw={1100}>
          <SendDialog
            event={event}
            template={sampleTemplate({ recipient_source: 'campers', filter: {} })}
            onClose={() => {}}
            onSent={() => {}}
          />
          {posted && (
            <Code block data-testid="posted">
              {`POST ${posted.url}\n${JSON.stringify(posted.body, null, 2)}`}
            </Code>
          )}
        </Stack>
      </ModalsProvider>
    </QueryClientProvider>
  );
};

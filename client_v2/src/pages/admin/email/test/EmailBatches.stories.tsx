/**
 * Ladle stories for the group email sends in the history (SPEC §8.9): one
 * sending, one scheduled, one finished with failures, and one cancelled.
 * Cancel and Retry failed are answered by the story. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { EmailBatches } from '../EmailBatches';
import { sampleBatch } from './emailFixtures';
import { stubEmailApi } from './stubEmailApi';

const batches = [
  sampleBatch({ total: 40, sent: 23, failed: 1, waiting: 16 }),
  sampleBatch({
    id: 32,
    name: 'Packing list',
    state: 'scheduled',
    status: 'scheduled',
    send_at: '2026-10-01T16:00:00Z',
    total: 0,
    sent: 0,
    failed: 0,
    waiting: 0,
  }),
  sampleBatch({
    id: 30,
    name: 'Welcome',
    state: 'done',
    total: 120,
    sent: 117,
    failed: 3,
    waiting: 0,
    skipped: [{ key: 'camper:9', label: 'Kit Doe', reason: 'already_sent' }],
    created_at: '2026-09-01T09:00:00Z',
  }),
  sampleBatch({
    id: 29,
    name: 'Schedule change',
    state: 'cancelled',
    status: 'cancelled',
    total: 50,
    sent: 12,
    failed: 0,
    cancelled: 38,
    waiting: 0,
    created_at: '2026-08-20T09:00:00Z',
  }),
];

export const Sends: Story = () => {
  const [selected, setSelected] = useState<number | undefined>();
  const [client] = useState(() => {
    stubEmailApi(() => {});
    return new QueryClient();
  });
  return (
    <QueryClientProvider client={client}>
      <ModalsProvider>
        <div style={{ maxWidth: 900, padding: 16 }}>
          <EmailBatches batches={batches} selectedId={selected} onSelect={setSelected} />
        </div>
      </ModalsProvider>
    </QueryClientProvider>
  );
};

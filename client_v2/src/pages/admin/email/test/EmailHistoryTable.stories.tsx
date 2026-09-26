/**
 * Ladle stories for the email history table (SPEC §8.9), with a page of mixed
 * messages; the filters work against the sample data. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import type { ApiEmailMessage } from 'api-types';
import { useState } from 'react';
import type { EmailHistoryFilters } from 'store/email';

import { EmailHistoryTable } from '../EmailHistoryTable';
import { sampleMessage } from './emailFixtures';

const MESSAGES: ApiEmailMessage[] = [
  sampleMessage({ id: 6, kind: 'bulk', to: 'sam@example.com', subject: 'Packing list' }),
  sampleMessage({
    id: 5,
    kind: 'bulk',
    to: 'kim@example.com',
    subject: 'Packing list',
    status: 'queued',
    sent_at: null,
    attempts: 0,
  }),
  sampleMessage({
    id: 4,
    kind: 'invitation',
    to: '"Lee" <lee@example.com>',
    subject: 'Staff registration for Camp',
    status: 'queued',
    sent_at: null,
    attempts: 2,
  }),
  sampleMessage({ id: 3, status: 'failed', sent_at: null, to: 'typo@exmaple.com' }),
  sampleMessage({
    id: 2,
    kind: 'confirmation',
    to: 'test@dontsend.com',
    status: 'cancelled',
    sent_at: null,
  }),
  sampleMessage({ id: 1 }),
];

export const History: Story = () => {
  const [filters, setFilters] = useState<EmailHistoryFilters>({});
  const [selected, setSelected] = useState<number>();
  const statuses = filters.status ? filters.status.split(',') : null;
  const kinds = filters.kind ? filters.kind.split(',') : null;
  const q = filters.q?.toLowerCase() ?? '';
  const results = MESSAGES.filter(
    (m) =>
      (!statuses || statuses.includes(m.status)) &&
      (!kinds || kinds.includes(m.kind)) &&
      (!q || m.to.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q)),
  );
  return (
    <EmailHistoryTable
      page={{ count: results.length, next: null, previous: null, results }}
      filters={filters}
      onFiltersChange={setFilters}
      onOpen={(m) => setSelected(m.id)}
      selectedId={selected}
    />
  );
};

export const Empty: Story = () => (
  <EmailHistoryTable
    page={{ count: 0, next: null, previous: null, results: [] }}
    filters={{}}
    onFiltersChange={() => {}}
    onOpen={() => {}}
  />
);

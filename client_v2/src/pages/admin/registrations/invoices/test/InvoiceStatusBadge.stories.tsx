/** Stories for an invoice's status badge (SPEC §9.7): each status. Run `npm run storybook`. */

import { Group } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import type { InvoiceStatus } from 'api-types';

import { InvoiceStatusBadge } from '../InvoiceStatusBadge';

export default { title: 'Invoice Status Badge' } satisfies Meta;

const STATUSES: InvoiceStatus[] = ['open', 'partially_paid', 'paid', 'overpaid', 'cancelled'];

export const Every: StoryFn = () => (
  <Group p="md">
    {STATUSES.map((status) => (
      <InvoiceStatusBadge key={status} status={status} />
    ))}
  </Group>
);

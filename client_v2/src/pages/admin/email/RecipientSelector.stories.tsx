/**
 * Ladle stories for the bulk email recipient selector (SPEC §8.9), with a
 * fixed result standing in for the server's recipient preview. Run
 * `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Stack } from '@mantine/core';
import type { BulkRecipientCriteria, BulkRecipientResolution } from 'api-types';
import { useState } from 'react';

import { EMPTY_CRITERIA, RecipientSelector } from './RecipientSelector';

const RESOLUTION: BulkRecipientResolution = {
  recipients: [
    {
      email: 'pat@example.com',
      name: 'Pat Alpha',
      label: 'Pat Alpha (camper #31)',
      registration: 12,
      camper: 31,
    },
    {
      email: 'lee@example.com',
      name: 'Lee Beta',
      label: 'Lee Beta (camper #33)',
      registration: 13,
      camper: 33,
    },
  ],
  skipped: [
    {
      label: 'Sam Alpha (camper #32)',
      reason: 'duplicate',
      detail: 'Same address as Pat Alpha (camper #31)',
      email: 'pat@example.com',
      registration: 12,
      camper: 32,
    },
    {
      label: 'Drew Gamma (camper #34)',
      reason: 'no_address',
      detail: '',
      email: '',
      registration: 14,
      camper: 34,
    },
    {
      label: 'Kim Delta (camper #35)',
      reason: 'filter_error',
      detail: "camper has no field 'lodgin'",
      email: '',
      registration: 15,
      camper: 35,
    },
  ],
  diagnostics: [],
};

function Selector({
  initial,
  resolution,
}: {
  initial: BulkRecipientCriteria;
  resolution?: BulkRecipientResolution;
}) {
  const [criteria, setCriteria] = useState(initial);
  return (
    <Stack maw={860} p="md">
      <RecipientSelector criteria={criteria} onChange={setCriteria} resolution={resolution} />
    </Stack>
  );
}

export const Campers: Story = () => (
  <Selector initial={{ ...EMPTY_CRITERIA, recipient_kind: 'campers' }} resolution={RESOLUTION} />
);

export const FilterError: Story = () => (
  <Selector
    initial={{ ...EMPTY_CRITERIA, recipient_filter: 'registration.balance >' }}
    resolution={{
      recipients: [],
      skipped: [],
      diagnostics: [
        {
          severity: 'error',
          kind: 'syntax',
          message: "Expected an expression, got 'end of input'",
          field: 'recipient_filter',
          line: 1,
          column: null,
        },
      ],
    }}
  />
);

export const ListedAddresses: Story = () => (
  <Selector
    initial={{
      ...EMPTY_CRITERIA,
      recipient_kind: 'manual',
      recipient_list: 'Ann Smith <ann@example.com>\nbob@example.com',
    }}
    resolution={{
      recipients: [
        {
          email: 'ann@example.com',
          name: 'Ann Smith',
          label: 'Ann Smith',
          registration: null,
          camper: null,
        },
        {
          email: 'bob@example.com',
          name: '',
          label: 'bob@example.com',
          registration: null,
          camper: null,
        },
      ],
      skipped: [],
      diagnostics: [],
    }}
  />
);

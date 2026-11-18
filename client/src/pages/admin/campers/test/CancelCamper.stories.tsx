/**
 * Stories for deleting a camper with the offer to keep a cancellation fee
 * (SPEC §8.5; §15, DR-168). Run `npm run storybook`.
 */

import { Paper } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import type { ApiDeletePreview } from 'api-types';
import { useState } from 'react';
import type { CancellationFee } from 'store/deletes';
import { formatMoney } from 'utils/money';

import { CancelCamperView } from '../CancelCamper';
import { CAMPER } from './previews';

function Frame({ preview }: { preview?: ApiDeletePreview }) {
  const [confirmed, setConfirmed] = useState<CancellationFee | null | undefined>(undefined);
  return (
    <Paper withBorder p="md" m="md" maw={480}>
      <CancelCamperView
        name="Sam Alpha"
        preview={preview}
        onConfirm={setConfirmed}
        onCancel={() => setConfirmed(undefined)}
      />
      {confirmed !== undefined && (
        <p data-testid="confirmed">
          {confirmed
            ? `Kept ${formatMoney(confirmed.amount)}: ${confirmed.notes}`
            : 'Deleted with no fee'}
        </p>
      )}
    </Paper>
  );
}

export default { title: 'Cancel Camper' } satisfies Meta;

export const OffersAFee: StoryFn = () => <Frame preview={CAMPER} />;
export const Checking: StoryFn = () => <Frame />;

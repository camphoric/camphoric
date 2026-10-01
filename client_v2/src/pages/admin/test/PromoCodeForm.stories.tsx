/**
 * Stories for the promo code form (SPEC §8.8; §15, DR-67): adding a code,
 * editing a per-registration one, and a per-camper one that expires.
 * Submitting shows what would be saved. Run `npm run storybook`.
 */

import { Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import type { ApiPromoCode } from 'api-types';
import { useState } from 'react';

import { type PromoCodeBody, PromoCodeForm } from '../PromoCodeForm';
import { samplePromoCode } from './promoCodeFixtures';

function Harness({ promoCode }: { promoCode?: ApiPromoCode }) {
  const [saved, setSaved] = useState<PromoCodeBody>();
  return (
    <Stack maw={640}>
      <PromoCodeForm
        promoCode={promoCode}
        onSubmit={setSaved}
        onCancel={() => setSaved(undefined)}
      />
      {saved && <pre>{JSON.stringify(saved, null, 2)}</pre>}
    </Stack>
  );
}

export default { title: 'Promo Code Form' } satisfies Meta;

export const New: StoryFn = () => <Harness />;

export const Editing: StoryFn = () => <Harness promoCode={samplePromoCode()} />;

export const PerCamperExpiring: StoryFn = () => (
  <Harness
    promoCode={samplePromoCode({
      label: 'Sibling discount',
      code: 'SIBLING',
      scope: 'camper',
      pricing_logic: { if: [{ '>': [{ var: 'camper.index' }, 0] }, 50, 0] },
      expiration_date: '2026-12-01T08:00:00Z',
    })}
  />
);

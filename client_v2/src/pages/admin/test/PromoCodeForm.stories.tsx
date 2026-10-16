/**
 * Stories for the promo code form (SPEC §8.8; §15, DR-67): adding a code,
 * editing a per-registration one, a per-camper one that expires, and one that
 * some registrants can't use (DR-107).
 * Submitting shows what would be saved; nobody else is editing (the story
 * answers the lease lookup itself). Run `npm run storybook`.
 */

import { Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiPromoCode } from 'api-types';
import { useState } from 'react';

import { type PromoCodeBody, PromoCodeForm } from '../PromoCodeForm';
import { samplePromoCode, sampleRegistrationType } from './promoCodeFixtures';

const TYPES = [sampleRegistrationType(11, 'Staff'), sampleRegistrationType(12, 'Work-trade')];

const realFetch = window.fetch.bind(window);

/** Nobody else is editing it: the form's lease lookup finds none. */
function stubLeases() {
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/leases/')) return Promise.resolve(Response.json([]));
    return realFetch(input, init);
  };
}

function Harness({ promoCode }: { promoCode?: ApiPromoCode }) {
  const [saved, setSaved] = useState<PromoCodeBody>();
  const [client] = useState(() => {
    stubLeases();
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  return (
    <QueryClientProvider client={client}>
      <Stack maw={640}>
        <PromoCodeForm
          promoCode={promoCode}
          registrationTypes={TYPES}
          onSubmit={setSaved}
          onCancel={() => setSaved(undefined)}
        />
        {saved && <pre>{JSON.stringify(saved, null, 2)}</pre>}
      </Stack>
    </QueryClientProvider>
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

export const NotForSome: StoryFn = () => (
  <Harness
    promoCode={samplePromoCode({
      label: 'Members',
      code: 'MEMBER',
      excluded_registration_types: [11],
      excludes_uninvited: true,
    })}
  />
);

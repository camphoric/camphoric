/**
 * Stories for the promo code field above "Continue to payment" (SPEC §7.1;
 * §15, DR-67): its states, and a working field whose server knows one code,
 * SPRING. Run `npm run storybook`.
 */

import { Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AppliedPromo } from 'api-types';
import { useState } from 'react';
import { useRegistrationStore } from 'store/registration';

import { PromoCodeEntry } from '../PromoCodeEntry';
import { usePromoCodeEntry } from '../usePromoCodeEntry';

const SPRING: AppliedPromo = {
  code: 'SPRING',
  label: 'Spring sale — $20 off',
  scope: 'registration',
  pricingLogic: 20,
};

const noop = () => {};

export default { title: 'Promo Code Entry' } satisfies Meta;

export const Empty: StoryFn = () => (
  <Stack maw={480} p="md">
    <PromoCodeEntry value="" applied={null} onChange={noop} onApply={noop} onRemove={noop} />
  </Stack>
);

export const Applied: StoryFn = () => (
  <Stack maw={480} p="md">
    <PromoCodeEntry
      value="SPRING"
      applied={SPRING}
      onChange={noop}
      onApply={noop}
      onRemove={noop}
    />
  </Stack>
);

export const Refused: StoryFn = () => (
  <Stack maw={480} p="md">
    <PromoCodeEntry
      value="WINTER"
      applied={null}
      error="That promo code isn’t valid for this event."
      onChange={noop}
      onApply={noop}
      onRemove={noop}
    />
  </Stack>
);

const realFetch = window.fetch.bind(window);

/** A server that accepts SPRING, whatever its case. */
function stubCheckPromo() {
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('/checkpromo')) return realFetch(input, init);
    const { code } = JSON.parse(init?.body as string) as { code: string };
    const accepted = code.trim().toUpperCase() === 'SPRING';
    return new Response(
      JSON.stringify(accepted ? SPRING : { detail: 'That promo code isn’t valid for this event.' }),
      { status: accepted ? 200 : 400, headers: { 'Content-Type': 'application/json' } },
    );
  };
}

function WorkingField() {
  const entry = usePromoCodeEntry('1', noop);
  const [submitted, setSubmitted] = useState(false);
  return (
    <Stack maw={480} p="md">
      <PromoCodeEntry {...entry.props} />
      <button type="button" onClick={() => setSubmitted(entry.readyToSubmit())}>
        Continue to payment
      </button>
      {submitted && <p>Submitted.</p>}
    </Stack>
  );
}

/** Try SPRING (accepted) and anything else (refused); Continue refuses an unapplied code. */
export const Working: StoryFn = () => {
  const [client] = useState(() => {
    stubCheckPromo();
    useRegistrationStore.getState().reset();
    return new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  });
  return (
    <QueryClientProvider client={client}>
      <WorkingField />
    </QueryClientProvider>
  );
};

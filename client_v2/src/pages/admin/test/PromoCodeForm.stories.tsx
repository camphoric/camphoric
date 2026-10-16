/**
 * Stories for the promo code form (SPEC §8.8; §15, DR-67): adding a code,
 * editing a per-registration one, a per-camper one that expires, and one that
 * some registrants can't use (DR-107).
 * Submitting shows what would be saved; nobody else is editing (the story
 * answers the edit-lease calls itself). Run `npm run storybook`.
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
const YOU = { id: 1, username: 'admin', first_name: 'Alex', last_name: 'Admin' };

/**
 * Nobody else is editing it: looking up its lease finds none, and taking one
 * (once the form has changes) gives this tab its own, which it gives up again.
 */
function stubLeases() {
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? 'GET';
    if (url.endsWith('/api/user')) return Promise.resolve(Response.json(YOU));
    if (url.includes('/api/leases/')) {
      if (method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
      if (method === 'POST') {
        const body = JSON.parse(init?.body as string) as Record<string, unknown>;
        const now = new Date();
        return Promise.resolve(
          Response.json({
            id: 1,
            model: body.model,
            object_id: body.object_id,
            event: 7,
            holder: { id: YOU.id, name: 'Alex Admin' },
            client_id: body.client_id,
            acquired_at: now.toISOString(),
            expires_at: new Date(now.getTime() + 90_000).toISOString(),
          }),
        );
      }
      return Promise.resolve(Response.json([]));
    }
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

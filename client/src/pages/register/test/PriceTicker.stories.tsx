/**
 * Stories for the live registration total (SPEC §7.1, §9.6), which reads the
 * registration store: nothing priced yet, a total, and a total being
 * recalculated (with its spinner). Run `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { useState } from 'react';
import { useRegistrationStore } from 'store/registration';

import { PriceTicker } from '../PriceTicker';

/** Puts the store in the given state once, before the ticker first renders. */
function Ticker({ total, updating = false }: { total: number; updating?: boolean }) {
  useState(() => {
    const store = useRegistrationStore.getState();
    store.reset();
    store.setTotals({ ...useRegistrationStore.getState().totals, total });
    store.setUpdating(updating);
  });
  return (
    <Box maw={480} p="md">
      <PriceTicker />
    </Box>
  );
}

export default { title: 'Price Ticker' } satisfies Meta;

export const NothingYet: StoryFn = () => <Ticker total={0} />;

export const Total: StoryFn = () => <Ticker total={1234.5} />;

export const Recalculating: StoryFn = () => <Ticker total={1234.5} updating />;

/**
 * Stories for the payment options (SPEC §7.2, §9.7): a deposit choice, a
 * single option, no handling fee, and an event without online payment. Run
 * `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { useState } from 'react';

import { PaymentOptions } from '../PaymentOptions';
import { DEPOSIT_OPTIONS, NO_FEE, SINGLE_OPTION } from './fixtures';

export default { title: 'Payment Options' } satisfies Meta;

export const DepositChoice: StoryFn = () => {
  const [selected, setSelected] = useState(DEPOSIT_OPTIONS.default);
  return (
    <Box p="md" maw={600}>
      <PaymentOptions
        paymentOptions={DEPOSIT_OPTIONS}
        selected={selected}
        onSelect={setSelected}
        online
        handlingPercent={2.5}
      />
    </Box>
  );
};

export const SingleOption: StoryFn = () => (
  <Box p="md" maw={600}>
    <PaymentOptions
      paymentOptions={SINGLE_OPTION}
      selected="Full payment"
      onSelect={() => undefined}
      online
      handlingPercent={2.5}
    />
  </Box>
);

export const NoHandlingFee: StoryFn = () => (
  <Box p="md" maw={600}>
    <PaymentOptions
      paymentOptions={NO_FEE}
      selected="Full payment"
      onSelect={() => undefined}
      online
      handlingPercent={null}
    />
  </Box>
);

export const CheckOnly: StoryFn = () => (
  <Box p="md" maw={600}>
    <PaymentOptions
      paymentOptions={DEPOSIT_OPTIONS}
      selected="50% Deposit"
      onSelect={() => undefined}
      online={false}
      handlingPercent={2.5}
    />
  </Box>
);

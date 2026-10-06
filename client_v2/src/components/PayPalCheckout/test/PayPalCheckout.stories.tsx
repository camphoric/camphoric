/**
 * Stories for PayPal's buttons as Camphoric uses them (SPEC §7.2; §15, DR-77,
 * DR-90). They load PayPal's sandbox script with its public `sb` client id;
 * creating an order is stubbed (it says so instead of reaching a server).
 * Unavailable gives a client id PayPal refuses, so its script won't load.
 * Run `npm run storybook`.
 */

import { Alert, Box, Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { useState } from 'react';

import { PayPalCheckout } from '../PayPalCheckout';

export default { title: 'PayPal Checkout' } satisfies Meta;

export const Buttons: StoryFn = () => {
  const [said, setSaid] = useState('');
  return (
    <Box p="md">
      <Stack>
        {said && <Alert>{said}</Alert>}
        <PayPalCheckout
          clientId="sb"
          createOrder={(paymentType) => {
            setSaid(`Our server would create the order for a ${paymentType} payment.`);
            return Promise.reject(new Error('No server in Storybook'));
          }}
          onApprove={(orderId, paymentType) => setSaid(`Approved ${paymentType} ${orderId}`)}
          onError={() => undefined}
        />
      </Stack>
    </Box>
  );
};

export const Disabled: StoryFn = () => (
  <Box p="md">
    <PayPalCheckout
      clientId="sb"
      disabled
      createOrder={() => Promise.reject(new Error('No server in Storybook'))}
      onApprove={() => undefined}
    />
  </Box>
);

export const Unavailable: StoryFn = () => (
  <Box p="md">
    <PayPalCheckout
      clientId="not-a-paypal-client-id"
      createOrder={() => Promise.reject(new Error('No server in Storybook'))}
      onApprove={() => undefined}
    />
  </Box>
);

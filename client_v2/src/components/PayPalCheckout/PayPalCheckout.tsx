/**
 * PayPal's buttons — its own account button and its Debit or Credit Card
 * button — with the order created and captured by our server (SPEC §7.2,
 * §9.7; §15, DR-77, DR-90). The browser never creates or captures an order:
 * `createOrder` asks our server for one, and `onApprove` hands the approved
 * order's id back for the server to check and capture. Which button was
 * clicked decides whether it's a PayPal or a Card payment.
 *
 * The page isn't blocked while PayPal's popup or inline card form is open
 * (#646); the container blocks it only once PayPal approves.
 */

import { Box } from '@mantine/core';
import type {
  PayPalButtonCreateOrder,
  PayPalButtonOnApprove,
  PayPalButtonOnClick,
  PayPalButtonOnError,
} from '@paypal/paypal-js';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import type { PaymentType } from 'api-types';
import { useRef } from 'react';

/** PayPal caps its buttons at 750px wide; every payment button shares that cap. */
export const PAYMENT_BUTTON_WIDTH = 750;
/** PayPal's button height (25–55); 50 matches Mantine's `lg` button. */
export const PAYMENT_BUTTON_HEIGHT = 50;

export interface PayPalCheckoutProps {
  clientId: string;
  /** Ask our server for an order; resolves to PayPal's order id. */
  createOrder: (paymentType: PaymentType) => Promise<string>;
  /** The payer approved the order: our server checks and captures it. */
  onApprove: (orderId: string, paymentType: PaymentType) => void;
  /** They closed PayPal's window without paying. */
  onCancel?: () => void;
  onError?: (error: unknown) => void;
  /** Called when a button is clicked, before the order is created. */
  onStart?: () => void;
  disabled?: boolean;
}

export function PayPalCheckout({
  clientId,
  createOrder,
  onApprove,
  onCancel,
  onError,
  onStart,
  disabled,
}: PayPalCheckoutProps) {
  // Which PayPal button was clicked ('paypal', 'card', 'venmo', …).
  const fundingSourceRef = useRef<string | undefined>(undefined);
  const paymentType = (): PaymentType => (fundingSourceRef.current === 'card' ? 'Card' : 'PayPal');

  // PayPal's buttons close over their first render's callbacks; read the latest.
  const latest = useRef({ createOrder, onApprove, onCancel, onError, onStart });
  latest.current = { createOrder, onApprove, onCancel, onError, onStart };

  const handleClick: PayPalButtonOnClick = (data) => {
    fundingSourceRef.current = data.fundingSource as string | undefined;
    latest.current.onStart?.();
  };

  const handleCreateOrder: PayPalButtonCreateOrder = () =>
    latest.current.createOrder(paymentType());

  const handleApprove: PayPalButtonOnApprove = (data) => {
    latest.current.onApprove(data.orderID, paymentType());
    return Promise.resolve();
  };

  const handleError: PayPalButtonOnError = (error) => latest.current.onError?.(error);

  return (
    /*
      The PayPal buttons live in a cross-origin iframe whose document is
      light-scheme. Browsers paint an iframe opaque white when its color
      scheme differs from the embedding element's, so under Mantine's dark
      scheme the whole button block turns white. Matching the wrapper to the
      iframe keeps it transparent. The tagline is dropped because its grey
      text is unreadable on a dark background. PayPal caps the buttons at
      750px, so the wrapper is capped and centred to match.
    */
    <Box style={{ colorScheme: 'light' }} w="100%" maw={PAYMENT_BUTTON_WIDTH} mx="auto">
      <PayPalScriptProvider options={{ clientId, currency: 'USD' }}>
        <PayPalButtons
          style={{ tagline: false, height: PAYMENT_BUTTON_HEIGHT }}
          disabled={disabled}
          onClick={handleClick}
          createOrder={handleCreateOrder}
          onApprove={handleApprove}
          onCancel={() => latest.current.onCancel?.()}
          onError={handleError}
        />
      </PayPalScriptProvider>
    </Box>
  );
}

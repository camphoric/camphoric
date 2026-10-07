/**
 * Payment step when payment is owed (total > 0) — SPEC §7.2. The registrant
 * chooses a payment option (the server works out each one's amount, #675) and
 * pays by check, or with PayPal's buttons (its own account button and its
 * Debit or Credit Card button).
 *
 * Load-bearing behaviors (SPEC §12):
 *  - Amounts come from the server: the browser never computes a deposit or a
 *    handling fee, and never creates or captures a PayPal order (§15, DR-89,
 *    DR-90). It posts the option's name; PayPal's buttons ask our server for
 *    the order, and hand the approved order back for the server to capture.
 *  - Pressing a payment button completes the registration (DR-91): after a
 *    cancelled or declined PayPal payment the registrant is registered and
 *    unpaid, and can try again, pay by check, or finish and pay later.
 *  - The page is blocked only once PayPal approves, never while PayPal's own
 *    popup or inline card form is open (DR-77).
 *  - If the organizers cancelled the registration invoice, any payment button
 *    is refused (`cancelled`): the page gives their message and offers only to
 *    finish (DR-105).
 */

import { Alert, Box, Button, LoadingOverlay, Stack, Text, Title } from '@mantine/core';
import type { ApiRegisterConfirmationStep, ApiRegisterPaymentStep, PaymentType } from 'api-types';
import { PAYMENT_BUTTON_WIDTH, PayPalCheckout } from 'components/PayPalCheckout';
import { useGoToStep } from 'hooks/useGoToStep';
import { useState } from 'react';
import { useRegistrationStore } from 'store/registration';
import {
  paymentProblem,
  useCreatePayPalOrder,
  useFinishRegistration,
  useRegistrationConfig,
  useSubmitPayment,
} from 'store/registrationApi';
import { formatMoney } from 'utils/money';

import { PaymentNotFinished } from './PaymentNotFinished';
import { PaymentOptions } from './PaymentOptions';

interface PaymentNeededProps {
  eventId: string;
  paymentStep: ApiRegisterPaymentStep;
}

/** Where things stand after a payment that didn't go through. */
interface NotFinished {
  reason?: string;
  unknown?: boolean;
  /** The organizers cancelled the invoice: nothing can be paid here. */
  invoiceCancelled?: boolean;
}

export function PaymentNeeded({ eventId, paymentStep }: PaymentNeededProps) {
  const goToStep = useGoToStep();
  const { data: config } = useRegistrationConfig(eventId);
  const submit = useSubmitPayment(eventId);
  const createOrder = useCreatePayPalOrder(eventId);
  const finish = useFinishRegistration(eventId);
  const setConfirmationStep = useRegistrationStore((state) => state.setConfirmationStep);

  const { paymentOptions, handlingPercent, registrationUUID } = paymentStep;
  const [selected, setSelected] = useState(paymentOptions.default);
  const option =
    paymentOptions.options.find((o) => o.name === selected) ?? paymentOptions.options[0];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once a PayPal button has completed the registration and it isn't paid.
  const [notFinished, setNotFinished] = useState<NotFinished | null>(null);

  const clientId = config?.payPalOptions?.clientId as string | undefined;

  const confirmed = (confirmation: ApiRegisterConfirmationStep) => {
    setConfirmationStep(confirmation);
    goToStep('finished');
  };

  /** Show why a payment button was refused; true when it was a cancelled invoice. */
  const refused = (e: unknown) => {
    const problem = paymentProblem(e);
    if (problem.code === 'cancelled') {
      setNotFinished({ reason: problem.message, invoiceCancelled: true });
      return true;
    }
    setError(problem.message);
    return false;
  };

  const payByCheck = () => {
    setError(null);
    setLoading(true);
    submit.mutate(
      { registrationUUID, paymentType: 'Check', paymentOption: option.name },
      {
        onSuccess: confirmed,
        onError: (e) => {
          setLoading(false);
          refused(e);
        },
      },
    );
  };

  // No overlay here: PayPal's popup or inline card form is open from now
  // until approval, and the card form sits under the overlay (#646).
  const createPayPalOrder = async (paymentType: PaymentType) => {
    setError(null);
    try {
      const order = await createOrder.mutateAsync({
        registrationUUID,
        paymentType,
        paymentOption: option.name,
      });
      return order.orderID;
    } catch (e) {
      refused(e);
      throw e;
    }
  };

  const capture = (orderId: string, paymentType: PaymentType) => {
    setLoading(true);
    submit.mutate(
      { registrationUUID, paymentType, paypalOrderId: orderId },
      {
        onSuccess: confirmed,
        onError: (e) => {
          setLoading(false);
          const problem = paymentProblem(e);
          setNotFinished({ reason: problem.message, unknown: problem.code === 'unknown' });
        },
      },
    );
  };

  const cancelled = () => {
    setLoading(false);
    // The button completed the registration (DR-91), unpaid.
    if (createOrder.isSuccess) setNotFinished({});
  };

  const payPalFailed = (e: unknown) => {
    setLoading(false);
    console.error('PayPal error', e);
    setError(
      (current) => current ?? 'PayPal ran into a problem. Please try again or pay by check.',
    );
  };

  const finishNow = () =>
    finish.mutate(registrationUUID, {
      onSuccess: confirmed,
    });

  if (notFinished?.unknown || notFinished?.invoiceCancelled) {
    return (
      <PaymentNotFinished
        amountDue={option.amount}
        reason={notFinished.reason}
        unknown={notFinished.unknown}
        invoiceCancelled={notFinished.invoiceCancelled}
        onFinish={finishNow}
        finishing={finish.isPending}
      />
    );
  }

  return (
    <Box pos="relative">
      <LoadingOverlay visible={loading} />
      <Stack>
        <Title order={3}>Choose your payment option</Title>

        {notFinished && (
          <PaymentNotFinished
            amountDue={option.amount}
            reason={notFinished.reason}
            onFinish={finishNow}
            finishing={finish.isPending}
          />
        )}

        <PaymentOptions
          paymentOptions={paymentOptions}
          selected={option.name}
          onSelect={setSelected}
          online={Boolean(clientId)}
          handlingPercent={handlingPercent}
          disabled={loading}
        />

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        {/* Sized and capped like the PayPal buttons below so the options read as one set. */}
        <Button
          size="lg"
          w="100%"
          maw={PAYMENT_BUTTON_WIDTH}
          mx="auto"
          onClick={payByCheck}
          loading={submit.isPending && !notFinished}
        >
          Pay {formatMoney(option.amount)} by check
        </Button>

        {clientId ? (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Pay {formatMoney(option.amount + option.handling)} online with your PayPal account, or
              choose “Debit or Credit Card” to pay by card without one.
            </Text>
            <PayPalCheckout
              clientId={clientId}
              createOrder={createPayPalOrder}
              onApprove={capture}
              onCancel={cancelled}
              onError={payPalFailed}
              onStart={() => setError(null)}
              disabled={loading}
            />
          </Stack>
        ) : (
          <Alert color="gray" variant="light">
            Online card payment is unavailable for this event; please pay by check.
          </Alert>
        )}
      </Stack>
    </Box>
  );
}

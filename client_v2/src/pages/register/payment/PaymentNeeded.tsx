/**
 * Payment step when payment is owed (total > 0) — SPEC §7.2. Offers pay-by-check
 * and PayPal/credit-card, with optional deposit options.
 *
 * Load-bearing behaviors (SPEC §12):
 *  - Check omits the e-payment handling fee, so the total is recomputed with
 *    payment type 'Check' rather than reusing the registration-step total.
 *  - A deposit choice carries a JSON-logic expression applied to the pricing
 *    results to get the amount due.
 *  - PayPal loses the local deposit selection, so it's embedded in the order's
 *    `custom_id` and recovered on capture.
 */

import { Alert, Box, Button, LoadingOverlay, Stack, Text, Title } from '@mantine/core';
import {
  type PayPalButtonCreateOrder,
  type PayPalButtonOnApprove,
} from '@paypal/paypal-js';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { useNavigate } from '@tanstack/react-router';
import type { ApiRegisterPaymentStep, InitialPaymentBody, PaymentType } from 'api-types';
import { JsonSchemaForm } from 'components/form';
import { calculatePrice } from 'pricing';
import { useRef, useState } from 'react';
import { useRegistrationStore } from 'store/registration';
import { useRegistrationConfig, useSubmitPayment } from 'store/registrationApi';
import { formatMoney } from 'utils/money';

import { applyDeposit, parseDeposit } from './deposits';

interface PaymentNeededProps {
  eventId: string;
  paymentStep: ApiRegisterPaymentStep;
}

export function PaymentNeeded({ eventId, paymentStep }: PaymentNeededProps) {
  const navigate = useNavigate();
  const { data: config } = useRegistrationConfig(eventId);
  const submit = useSubmitPayment(eventId);
  const registration = useRegistrationStore((state) => state.registration);
  const setPaymentInfo = useRegistrationStore((state) => state.setPaymentInfo);
  const setConfirmationStep = useRegistrationStore((state) => state.setConfirmationStep);

  const totals = paymentStep.serverPricingResults;
  const hasDeposits = Boolean(paymentStep.deposit);
  const defaultDeposit = (paymentStep.deposit?.default as string | undefined) ?? '';

  const [depositValue, setDepositValue] = useState(defaultDeposit);
  const [total, setTotal] = useState(() =>
    hasDeposits ? applyDeposit(parseDeposit(defaultDeposit), totals) : (totals.total ?? 0),
  );
  const [loading, setLoading] = useState(false);

  // PayPal reads the latest values through refs (its buttons close over the
  // values from their first render).
  const totalRef = useRef(total);
  totalRef.current = total;
  const depositRef = useRef(depositValue);
  depositRef.current = depositValue;

  const processResult = (initialPayment: InitialPaymentBody) => {
    setLoading(true);
    setPaymentInfo(initialPayment);
    submit.mutate(initialPayment, {
      onSuccess: (confirmation) => {
        setConfirmationStep(confirmation);
        void navigate({ to: '/events/$eventId/register/finished', params: { eventId } });
      },
      onError: () => setLoading(false),
    });
  };

  const handleDepositChange = (formData: unknown) => {
    const value = (formData as { deposit?: string }).deposit ?? '';
    setDepositValue(value);
    setTotal(hasDeposits ? applyDeposit(parseDeposit(value), totals) : (totals.total ?? 0));
  };

  const payByCheck = () => {
    // Recompute without the handling fee (Check is fee-free) — SPEC §7.2, §12.
    const checkTotals = config
      ? calculatePrice(config, registration, 'Check')
      : totals;
    const deposit = parseDeposit(depositValue);
    const finalTotal = hasDeposits ? applyDeposit(deposit, checkTotals) : (checkTotals.total ?? 0);
    processResult({
      registrationUUID: paymentStep.registrationUUID,
      paymentType: 'Check',
      paymentData: { type: hasDeposits ? deposit.name : 'None', total: finalTotal },
    });
  };

  const createOrder: PayPalButtonCreateOrder = (_data, actions) => {
    setLoading(true);
    return actions.order.create({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: 'USD', value: totalRef.current.toFixed(2) },
          description: `${config?.dataSchema.title ?? 'Registration'} payment`,
          // Embed the deposit choice; PayPal loses it otherwise (SPEC §12).
          custom_id: parseDeposit(depositRef.current).name,
          reference_id: paymentStep.registrationUUID,
        },
      ],
    });
  };

  const onApprove: PayPalButtonOnApprove = async (_data, actions) => {
    if (!actions.order) return;
    setLoading(true);
    try {
      const details = await actions.order.capture();
      const unit = details.purchase_units?.[0];
      const amount = parseFloat(unit?.amount?.value ?? '0');
      const depositType = hasDeposits ? (unit?.custom_id ?? 'None') : 'None';
      // The default PayPal button reports a PayPal payment; distinguishing a
      // card funding source can be refined against the sandbox capture response.
      const paymentType: PaymentType = 'PayPal';
      processResult({
        registrationUUID: paymentStep.registrationUUID,
        paymentType,
        paymentData: { type: depositType, total: amount },
        payPalResponse: details,
      });
    } catch (error) {
      setLoading(false);
      console.error('PayPal capture failed', error);
    }
  };

  const clientId = config?.payPalOptions?.clientId as string | undefined;

  return (
    <Box pos="relative">
      <LoadingOverlay visible={loading} />
      <Stack>
        <Title order={3}>Choose your payment option</Title>
        <Text fw={600}>Total: {formatMoney(total)}</Text>

        {paymentStep.deposit ? (
          <JsonSchemaForm
            schema={{
              type: 'object',
              properties: { deposit: { type: 'string', ...paymentStep.deposit } },
            }}
            uiSchema={{ deposit: { 'ui:placeholder': 'Choose an option' } }}
            formData={{ deposit: depositValue }}
            onChange={handleDepositChange}
          >
            <></>
          </JsonSchemaForm>
        ) : null}

        <Button onClick={payByCheck} loading={submit.isPending}>
          Pay by check
        </Button>

        {clientId ? (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              To pay by credit card, choose PayPal, then “Pay with debit or credit card”.
            </Text>
            <PayPalScriptProvider options={{ clientId, currency: 'USD' }}>
              <PayPalButtons createOrder={createOrder} onApprove={onApprove} />
            </PayPalScriptProvider>
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

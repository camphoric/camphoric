/**
 * Step 2 — payment (SPEC §7.2). Reads the payment-step payload's total: zero
 * means no payment is collected, otherwise the registrant chooses how to pay.
 * If the payment-step data is missing (e.g. direct navigation/refresh), it
 * redirects back to step 1.
 */

import { useEventId } from 'hooks/useEventId';
import { useGoToStep } from 'hooks/useGoToStep';
import { useEffect } from 'react';
import { useRegistrationStore } from 'store/registration';

import { NoPayment } from './payment/NoPayment';
import { PaymentNeeded } from './payment/PaymentNeeded';

export function PaymentStep() {
  const eventId = useEventId();
  const goToStep = useGoToStep();
  const paymentStep = useRegistrationStore((state) => state.paymentStep);

  useEffect(() => {
    if (!paymentStep) goToStep('registration');
  }, [paymentStep, goToStep]);

  if (!paymentStep) return null;

  const total = paymentStep.serverPricingResults.total ?? 0;

  return total > 0 ? (
    <PaymentNeeded eventId={eventId} paymentStep={paymentStep} />
  ) : (
    <NoPayment eventId={eventId} registrationUUID={paymentStep.registrationUUID} />
  );
}

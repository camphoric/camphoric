/**
 * Step 2 — payment (SPEC §7.2). Reads the payment-step payload's total: zero
 * means no payment is collected, otherwise the registrant chooses how to pay.
 * If the payment-step data is missing (e.g. direct navigation/refresh), it
 * redirects back to step 1.
 */

import { useNavigate, useParams } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useRegistrationStore } from 'store/registration';

import { NoPayment } from './payment/NoPayment';
import { PaymentNeeded } from './payment/PaymentNeeded';

export function PaymentStep() {
  const { eventId } = useParams({ strict: false });
  const navigate = useNavigate();
  const paymentStep = useRegistrationStore((state) => state.paymentStep);

  useEffect(() => {
    if (!paymentStep) {
      void navigate({ to: '/events/$eventId/register/registration', params: { eventId } });
    }
  }, [paymentStep, navigate, eventId]);

  if (!paymentStep) return null;

  const total = paymentStep.serverPricingResults.total ?? 0;

  return total > 0 ? (
    <PaymentNeeded eventId={eventId} paymentStep={paymentStep} />
  ) : (
    <NoPayment eventId={eventId} registrationUUID={paymentStep.registrationUUID} />
  );
}

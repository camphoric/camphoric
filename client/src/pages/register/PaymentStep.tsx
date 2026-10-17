/**
 * Step 2 — payment (SPEC §7.2). Shows a read-only review of the submitted
 * registration, then reads the payment-step payload's total: zero means no
 * payment is collected, otherwise the registrant chooses how to pay. If the
 * payment-step data is missing (a reload, or a return after leaving PayPal),
 * it's resumed from what this browser saved when the form was sent — the
 * payment step with the form data and promo code it was sent with, so the review
 * still shows what was entered; with none, it redirects back to step 1. Once
 * there's a payment step, it's asked for again from the server, so a page
 * reopened later shows what's due now — an organizer may have changed it (§15,
 * DR-105); if that fails, what was saved stands. If the server no longer has the
 * registration, the saved one is forgotten and it's back to step 1 (§7.1).
 */

import { Stack } from '@mantine/core';
import { useEventId } from 'hooks/useEventId';
import { useGoToStep } from 'hooks/useGoToStep';
import { useEffect, useRef } from 'react';
import { useRegistrationStore } from 'store/registration';
import {
  registrationNotFound,
  useRefreshPaymentStep,
  useRegistrationConfig,
} from 'store/registrationApi';

import { NoPayment } from './payment/NoPayment';
import { PaymentNeeded } from './payment/PaymentNeeded';
import { RegistrationReview } from './payment/RegistrationReview';
import { getRegistrationStorageKey, loadSentRegistration } from './storage';
import { useForgetSentRegistration } from './useForgetSentRegistration';
import { useReplacePaymentStep } from './useReplacePaymentStep';

export function PaymentStep() {
  const eventId = useEventId();
  const goToStep = useGoToStep();
  const paymentStep = useRegistrationStore((state) => state.paymentStep);
  const resumeSent = useRegistrationStore((state) => state.resumeSent);
  const registration = useRegistrationStore((state) => state.registration);
  const promo = useRegistrationStore((state) => state.promo);
  const sentNotFound = useRegistrationStore((state) => state.sentNotFound);
  const { data: config } = useRegistrationConfig(eventId);

  useEffect(() => {
    if (paymentStep || !config) return;
    // Just found gone: back to step 1 to say so, not on to one another tab saved since.
    const saved = sentNotFound ? null : loadSentRegistration(getRegistrationStorageKey(config));
    if (saved) resumeSent(saved);
    else goToStep('registration');
  }, [paymentStep, config, sentNotFound, resumeSent, goToStep]);

  // Once per registration: what's due now, not what was due when it was sent.
  const { mutate: refreshPaymentStep } = useRefreshPaymentStep(eventId);
  const replacePaymentStep = useReplacePaymentStep();
  const forgetSentRegistration = useForgetSentRegistration();
  const refreshed = useRef<string | null>(null);
  const registrationUUID = paymentStep?.registrationUUID;
  useEffect(() => {
    if (!registrationUUID || refreshed.current === registrationUUID) return;
    refreshed.current = registrationUUID;
    refreshPaymentStep(registrationUUID, {
      onSuccess: replacePaymentStep,
      onError: (error) => {
        if (registrationNotFound(error)) forgetSentRegistration(registrationUUID);
      },
    });
  }, [registrationUUID, refreshPaymentStep, replacePaymentStep, forgetSentRegistration]);

  if (!paymentStep) return null;

  const total = paymentStep.serverPricingResults.total ?? 0;

  return (
    <Stack gap="xl">
      {config && (
        <RegistrationReview
          config={config}
          registration={registration}
          results={paymentStep.serverPricingResults}
          promo={promo}
        />
      )}
      {total > 0 ? (
        <PaymentNeeded eventId={eventId} paymentStep={paymentStep} />
      ) : (
        <NoPayment eventId={eventId} registrationUUID={paymentStep.registrationUUID} />
      )}
    </Stack>
  );
}

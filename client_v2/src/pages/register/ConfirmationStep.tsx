/**
 * Step 3 — confirmation (SPEC §7.3). Renders the server-provided confirmation
 * template with the template-variable bundle (initialPayment, paymentInfo,
 * registration, totals, pricing_results), clears the saved localStorage data
 * (unless KEEP_REG_DATA is set), and resets the in-progress registration.
 * Redirects back to step 1 if there's no confirmation data (direct nav/refresh).
 *
 * The confirmation data is snapshotted on first render so resetting the store
 * afterwards doesn't blank the page.
 */

import { Stack, Title } from '@mantine/core';
import { ErrorBoundary } from 'components/ErrorBoundary';
import { Template } from 'components/templating';
import { useEventId } from 'hooks/useEventId';
import { useGoToStep } from 'hooks/useGoToStep';
import { useEffect, useRef, useState } from 'react';
import { useRegistrationStore } from 'store/registration';
import { useRegistrationConfig } from 'store/registrationApi';

import { clearRegistrationFormData, getRegistrationStorageKey } from './storage';

interface ConfirmationSnapshot {
  template: string;
  templateVars: Record<string, unknown>;
}

function captureConfirmation(): ConfirmationSnapshot | null {
  const { confirmationStep, paymentStep, paymentInfo, registration } =
    useRegistrationStore.getState();
  if (!confirmationStep || !paymentStep) return null;
  return {
    template: confirmationStep.confirmationPageTemplate,
    templateVars: {
      initialPayment: confirmationStep.initialPayment,
      paymentInfo,
      registration,
      totals: paymentStep.serverPricingResults,
      pricing_results: confirmationStep.serverPricingResults,
    },
  };
}

export function ConfirmationStep() {
  const eventId = useEventId();
  const goToStep = useGoToStep();
  const { data: config } = useRegistrationConfig(eventId);

  // Snapshot synchronously so the page survives the store reset below.
  const [snapshot] = useState(captureConfirmation);
  const finished = useRef(false);

  useEffect(() => {
    if (!snapshot) {
      goToStep('registration');
      return;
    }
    // Clear saved data (needs the config-derived key) and reset, once.
    if (finished.current || !config) return;
    finished.current = true;
    clearRegistrationFormData(getRegistrationStorageKey(config));
    useRegistrationStore.getState().reset();
  }, [snapshot, config, goToStep]);

  if (!snapshot) return null;

  return (
    <Stack>
      <Title order={3}>You're registered!</Title>
      <ErrorBoundary>
        <Template markdown={snapshot.template} templateVars={snapshot.templateVars} />
      </ErrorBoundary>
    </Stack>
  );
}

/**
 * Step 3 — confirmation (SPEC §7.3). Renders the server-provided confirmation
 * template with the template-variable bundle (initialPayment, paymentInfo,
 * registration, totals, pricing_results), clears the saved localStorage data
 * (unless KEEP_REG_DATA is set), and resets the in-progress registration.
 * Redirects back to step 1 if there's no confirmation data (direct nav/refresh).
 *
 * The confirmation data is snapshotted on mount so resetting the store
 * afterwards doesn't blank the page.
 */

import { Stack, Title } from '@mantine/core';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ErrorBoundary } from 'components/ErrorBoundary';
import { Template } from 'components/templating';
import { useEffect, useRef, useState } from 'react';
import { useRegistrationStore } from 'store/registration';
import { useRegistrationConfig } from 'store/registrationApi';

import { clearRegistrationFormData, getRegistrationStorageKey } from './storage';

interface ConfirmationSnapshot {
  template: string;
  templateVars: Record<string, unknown>;
}

export function ConfirmationStep() {
  const { eventId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { data: config } = useRegistrationConfig(eventId);

  const [snapshot, setSnapshot] = useState<ConfirmationSnapshot | null>(null);
  const handled = useRef(false);
  const cleared = useRef(false);

  // Capture the confirmation data once (or redirect if there's none), then
  // reset the in-progress registration.
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const state = useRegistrationStore.getState();
    if (!state.confirmationStep || !state.paymentStep) {
      void navigate({ to: '/events/$eventId/register/registration', params: { eventId } });
      return;
    }
    setSnapshot({
      template: state.confirmationStep.confirmationPageTemplate,
      templateVars: {
        initialPayment: state.confirmationStep.initialPayment,
        paymentInfo: state.paymentInfo,
        registration: state.registration,
        totals: state.paymentStep.serverPricingResults,
        pricing_results: state.confirmationStep.serverPricingResults,
      },
    });
    state.reset();
  }, [navigate, eventId]);

  // Clear the saved form data once the config (and so the storage key) is known.
  useEffect(() => {
    if (cleared.current || !config || !snapshot) return;
    cleared.current = true;
    clearRegistrationFormData(getRegistrationStorageKey(config));
  }, [config, snapshot]);

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

/**
 * Step 3 — confirmation (SPEC §7.3). Shows the confirmation page the server
 * rendered for this registration (markdown, through the sanitizing pipeline),
 * clears the saved localStorage data (unless KEEP_REG_DATA is set), and resets
 * the in-progress registration. Redirects back to step 1 if there's no
 * confirmation data (direct nav/refresh).
 *
 * The page is snapshotted on first render so resetting the store afterwards
 * doesn't blank it.
 */

import { Stack, Title } from '@mantine/core';
import { ErrorBoundary } from 'components/ErrorBoundary';
import { markdownToHtml } from 'components/templating';
import { useEventId } from 'hooks/useEventId';
import { useGoToStep } from 'hooks/useGoToStep';
import { useEffect, useRef, useState } from 'react';
import { useRegistrationStore } from 'store/registration';
import { useRegistrationConfig } from 'store/registrationApi';

import { clearRegistrationFormData, getRegistrationStorageKey } from './storage';

/** The rendered page (sanitized HTML), or null when there's no confirmation data. */
function captureConfirmation(): string | null {
  const { confirmationStep } = useRegistrationStore.getState();
  if (!confirmationStep) return null;
  return markdownToHtml(confirmationStep.confirmationPage ?? '');
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
        {/* Safe: markdownToHtml sanitizes via rehype-sanitize (§11). */}
        <div className="md-template" dangerouslySetInnerHTML={{ __html: snapshot }} />
      </ErrorBoundary>
    </Stack>
  );
}

/**
 * The server no longer has the registration this browser sent (SPEC §7.1, §7.2):
 * an organizer deleted it, or it was purged as incomplete (§15, DR-76). Forget
 * the one saved and go back to step 1, which keeps what was entered and says to
 * send the form again — paying for it can only fail. The same goes for one whose
 * lodging filled up before it was completed (§15, DR-140): pass the server's message
 * as `lodgingProblem`, and step 1 says to choose again, and its `reopen`, which the
 * draft saves then send (§15, DR-142).
 */

import { useEventId } from 'hooks/useEventId';
import { useGoToStep } from 'hooks/useGoToStep';
import { useCallback } from 'react';
import { useRegistrationStore } from 'store/registration';
import { useRegistrationConfig } from 'store/registrationApi';

import { clearSentRegistration, getRegistrationStorageKey, loadSentRegistration } from './storage';

export function useForgetSentRegistration() {
  const eventId = useEventId();
  const { data: config } = useRegistrationConfig(eventId);
  const forgetSent = useRegistrationStore((state) => state.forgetSent);
  const lodgingTaken = useRegistrationStore((state) => state.lodgingTaken);
  const goToStep = useGoToStep();
  return useCallback(
    (registrationUUID: string, lodgingProblem?: string, reopen?: string) => {
      if (config) {
        const key = getRegistrationStorageKey(eventId, config);
        // Another tab may have sent a new one since: that one is still good.
        // (Clearing takes the legacy-key copy too, when it's the same one.)
        if (loadSentRegistration(key)?.paymentStep.registrationUUID === registrationUUID) {
          clearSentRegistration(key);
        }
      }
      if (lodgingProblem) lodgingTaken(lodgingProblem, reopen);
      else forgetSent();
      goToStep('registration');
    },
    [eventId, config, forgetSent, lodgingTaken, goToStep],
  );
}

/**
 * The server no longer has the registration this browser sent (SPEC §7.1, §7.2):
 * an organizer deleted it, or it was purged as incomplete (§15, DR-76). Forget
 * the one saved and go back to step 1, which keeps what was entered and says to
 * send the form again — paying for it can only fail.
 */

import { useEventId } from 'hooks/useEventId';
import { useGoToStep } from 'hooks/useGoToStep';
import { useCallback } from 'react';
import { useRegistrationStore } from 'store/registration';
import { useRegistrationConfig } from 'store/registrationApi';

import { clearSentRegistration, getRegistrationStorageKey, loadSentRegistration } from './storage';

export function useForgetSentRegistration() {
  const { data: config } = useRegistrationConfig(useEventId());
  const forgetSent = useRegistrationStore((state) => state.forgetSent);
  const goToStep = useGoToStep();
  return useCallback(
    (registrationUUID: string) => {
      if (config) {
        const key = getRegistrationStorageKey(config);
        // Another tab may have sent a new one since: that one is still good.
        if (loadSentRegistration(key)?.paymentStep.registrationUUID === registrationUUID) {
          clearSentRegistration(key);
        }
      }
      forgetSent();
      goToStep('registration');
    },
    [config, forgetSent, goToStep],
  );
}

/**
 * Put a fresher payment step in place (SPEC §7.2; §15, DR-105): in the store,
 * and in the sent registration this browser saved, so a reload shows it too.
 * The server sends one when an organizer has changed what's due.
 */

import type { ApiRegisterPaymentStep } from 'api-types';
import { useEventId } from 'hooks/useEventId';
import { useCallback } from 'react';
import { useRegistrationStore } from 'store/registration';
import { useRegistrationConfig } from 'store/registrationApi';

import { getRegistrationStorageKey, loadSentRegistration, saveSentRegistration } from './storage';

export function useReplacePaymentStep() {
  const { data: config } = useRegistrationConfig(useEventId());
  const setPaymentStep = useRegistrationStore((state) => state.setPaymentStep);
  return useCallback(
    (paymentStep: ApiRegisterPaymentStep) => {
      setPaymentStep(paymentStep);
      if (!config) return;
      const key = getRegistrationStorageKey(config);
      const saved = loadSentRegistration(key);
      if (saved?.paymentStep.registrationUUID === paymentStep.registrationUUID) {
        saveSentRegistration(key, { ...saved, paymentStep });
      }
    },
    [config, setPaymentStep],
  );
}

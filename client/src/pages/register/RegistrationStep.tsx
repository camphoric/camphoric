/**
 * Step 1 — the registration form (SPEC §7.1). Renders the data-driven form and,
 * on every change, saves the form data to the store, recomputes the live total
 * with `calculatePrice`, and persists to localStorage (debounced). On mount it
 * rehydrates any saved data. When the event has promo codes, a field above the
 * submit button applies one (repriced live); a code typed but not applied blocks
 * submitting. Submitting posts the registration, saves what was sent with the
 * payment step it got back (so a reload resumes paying for it) and advances to
 * the payment step. A registration already sent from this browser offers to
 * continue paying for it instead; one the server turned out not to have brings
 * the registrant back here, with what they entered, to send it again.
 */

import { Alert, Button, Stack } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import type { AppliedPromo, RegistrationFormData } from 'api-types';
import { JsonSchemaForm } from 'components/form';
import { Template } from 'components/templating';
import { useEventId } from 'hooks/useEventId';
import { useGoToStep } from 'hooks/useGoToStep';
import { calculatePrice } from 'pricing';
import { useEffect, useRef, useState } from 'react';
import { useRegistrationStore } from 'store/registration';
import {
  useCheckSentRegistration,
  useRegistrationConfig,
  useSubmitRegistration,
} from 'store/registrationApi';
import { debug } from 'utils/debug';

import { PriceTicker } from './PriceTicker';
import { PromoCodeEntry, usePromoCodeEntry } from './PromoCodeEntry';
import {
  adoptLegacySentRegistration,
  clearRegistrationFormData,
  clearSentRegistration,
  getRegistrationStorageKey,
  loadLegacySentRegistration,
  loadRegistrationFormData,
  loadSentRegistration,
  saveRegistrationFormData,
  saveSentRegistration,
} from './storage';

export function RegistrationStep() {
  const eventId = useEventId();
  const goToStep = useGoToStep();
  const { data: config } = useRegistrationConfig(eventId);
  const submit = useSubmitRegistration(eventId);

  const registration = useRegistrationStore((state) => state.registration);
  const totals = useRegistrationStore((state) => state.totals);
  const promo = useRegistrationStore((state) => state.promo);
  const setRegistration = useRegistrationStore((state) => state.setRegistration);
  const setTotals = useRegistrationStore((state) => state.setTotals);
  const setUpdating = useRegistrationStore((state) => state.setUpdating);
  const setPaymentStep = useRegistrationStore((state) => state.setPaymentStep);
  const resumeSent = useRegistrationStore((state) => state.resumeSent);
  const sentNotFound = useRegistrationStore((state) => state.sentNotFound);

  const storageKey = config ? getRegistrationStorageKey(eventId, config) : '';
  // A registration already sent from this browser: offer to go on paying for it.
  const [sentBefore, setSentBefore] = useState(() =>
    storageKey ? loadSentRegistration(storageKey) : null,
  );
  // Read again once the config (and with it the storage key) arrives.
  const [sentBeforeKey, setSentBeforeKey] = useState(storageKey);
  if (storageKey && storageKey !== sentBeforeKey) {
    setSentBeforeKey(storageKey);
    setSentBefore(loadSentRegistration(storageKey));
  }
  // One saved before the storage key carried the event id may be another
  // event's: offer it only once the server confirms it's this event's.
  const { mutate: checkSent, isPending: checkingSent } = useCheckSentRegistration(eventId);
  useEffect(() => {
    if (!storageKey || loadSentRegistration(storageKey)) return;
    const legacy = loadLegacySentRegistration(storageKey);
    if (!legacy) return;
    checkSent(legacy.paymentStep.registrationUUID, {
      onSuccess: (paymentStep) => {
        // Unless one was sent, or the legacy one cleared, meanwhile.
        if (loadSentRegistration(storageKey) || !loadLegacySentRegistration(storageKey)) return;
        const adopted = { ...legacy, paymentStep };
        adoptLegacySentRegistration(storageKey, adopted);
        setSentBefore(adopted);
      },
    });
  }, [storageKey, checkSent]);

  const debouncedSave = useDebouncedCallback((data: RegistrationFormData) => {
    if (storageKey) saveRegistrationFormData(storageKey, data);
  }, 600);

  // Rehydrate saved form data once, then recompute the price from it.
  const rehydrated = useRef(false);
  useEffect(() => {
    if (rehydrated.current || !config) return;
    rehydrated.current = true;
    const saved = loadRegistrationFormData(getRegistrationStorageKey(eventId, config));
    if (saved) {
      setRegistration(saved);
      setTotals(calculatePrice(config, saved, useRegistrationStore.getState().promo));
    }
  }, [eventId, config, setRegistration, setTotals]);

  const promoEntry = usePromoCodeEntry(
    eventId,
    (applied: AppliedPromo | null) => {
      // Price what's in the form now, not what was there when Apply was clicked.
      const current = useRegistrationStore.getState().registration;
      if (config) setTotals(calculatePrice(config, current, applied));
    },
    config?.invitation,
  );

  const handleChange = (formData: unknown) => {
    if (!config) return;
    const data = formData as RegistrationFormData;
    const nextTotals = calculatePrice(config, data, promo);
    debug('RegistrationStep onChange', { formData: data, totals: nextTotals });
    setUpdating(true);
    setRegistration(data);
    setTotals(nextTotals);
    setUpdating(false);
    debouncedSave(data);
  };

  // Dev aid: expose the change handler for autofill (SPEC §10).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { regOnChange?: (data: RegistrationFormData) => void }).regOnChange =
      handleChange;
  });

  if (!config) return null;

  const continueSent = () => {
    if (!sentBefore) return;
    resumeSent(sentBefore);
    goToStep('payment');
  };

  const startOver = () => {
    clearSentRegistration(storageKey);
    clearRegistrationFormData(storageKey);
    setSentBefore(null);
    useRegistrationStore.getState().reset();
  };

  const templateData = {
    ...config.templateVars,
    pricing: config.pricing,
    formData: registration,
    totals,
  };

  // The form itself focuses the first field with an error (SPEC §7.1).
  const handleError = (errors: unknown[]) => debug('RegistrationStep onError', errors);

  const handleSubmit = () => {
    if (!promoEntry.readyToSubmit()) return;
    submit.mutate(
      {
        formData: registration,
        pricingResults: totals,
        ...(config.invitation ? { invitation: config.invitation } : {}),
        ...(promo ? { promoCode: promo.code } : {}),
      },
      {
        onSuccess: (paymentStep) => {
          debug('RegistrationStep submit result', paymentStep);
          saveSentRegistration(storageKey, { paymentStep, formData: registration, promo });
          setPaymentStep(paymentStep);
          goToStep('payment');
        },
      },
    );
  };

  return (
    // The class lets an event's uiSchema hide fields during registration only (SPEC §7.1).
    <Stack className="camphoric-registration">
      {sentNotFound && (
        <Alert variant="light" color="yellow" title="We couldn’t find your earlier registration">
          Please send the form again.
        </Alert>
      )}
      {sentBefore && (
        <Alert variant="light" color="blue" title="You’ve already sent this registration">
          <Stack gap="xs" align="flex-start">
            You can go on to pay for it, or start a new registration.
            <Button size="xs" onClick={continueSent}>
              Continue to payment
            </Button>
            <Button size="xs" variant="subtle" onClick={startOver}>
              Start a new registration
            </Button>
          </Stack>
        </Alert>
      )}
      <JsonSchemaForm
        schema={config.dataSchema}
        uiSchema={config.uiSchema}
        formData={registration}
        templateData={templateData}
        errorMessages={{ rules: config.registrationErrorMessages }}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onError={handleError}
      >
        <Stack mt="md">
          {config.event.epayment_handling && config.payPalOptions ? (
            <Alert variant="light" color="blue" title="Handling charge">
              There is a {config.event.epayment_handling}% handling charge on electronic payments,
              added to the amount you pay online — pay by check to avoid it.
            </Alert>
          ) : null}
          <Template markdown={config.preSubmitTemplate} templateVars={templateData} />
          {config.hasPromoCodes && <PromoCodeEntry {...promoEntry.props} />}
          {/* Not while checking one sent before, which would be sent again. */}
          <Button type="submit" loading={submit.isPending || checkingSent}>
            Continue to payment
          </Button>
        </Stack>
      </JsonSchemaForm>
      <PriceTicker />
    </Stack>
  );
}

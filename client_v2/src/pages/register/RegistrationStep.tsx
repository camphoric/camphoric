/**
 * Step 1 — the registration form (SPEC §7.1). Renders the data-driven form and,
 * on every change, saves the form data to the store, recomputes the live total
 * with `calculatePrice`, and persists to localStorage (debounced). On mount it
 * rehydrates any saved data. When the event has promo codes, a field above the
 * submit button applies one (repriced live); a code typed but not applied blocks
 * submitting. Submitting posts the registration, saves the payment step (so a
 * reload resumes paying for it) and advances to the payment step. A registration
 * already sent from this browser offers to continue paying for it instead.
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
import { useRegistrationConfig, useSubmitRegistration } from 'store/registrationApi';
import { debug } from 'utils/debug';

import { PriceTicker } from './PriceTicker';
import { PromoCodeEntry, usePromoCodeEntry } from './PromoCodeEntry';
import {
  clearPaymentStep,
  clearRegistrationFormData,
  getRegistrationStorageKey,
  loadPaymentStep,
  loadRegistrationFormData,
  savePaymentStep,
  saveRegistrationFormData,
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

  const storageKey = config ? getRegistrationStorageKey(config) : '';
  // A registration already sent from this browser: offer to go on paying for it.
  const [sentBefore, setSentBefore] = useState(() =>
    storageKey ? loadPaymentStep(storageKey) : null,
  );
  useEffect(() => {
    if (storageKey) setSentBefore(loadPaymentStep(storageKey));
  }, [storageKey]);

  const debouncedSave = useDebouncedCallback((data: RegistrationFormData) => {
    if (storageKey) saveRegistrationFormData(storageKey, data);
  }, 600);

  // Rehydrate saved form data once, then recompute the price from it.
  const rehydrated = useRef(false);
  useEffect(() => {
    if (rehydrated.current || !config) return;
    rehydrated.current = true;
    const saved = loadRegistrationFormData(getRegistrationStorageKey(config));
    if (saved) {
      setRegistration(saved);
      setTotals(calculatePrice(config, saved, useRegistrationStore.getState().promo));
    }
  }, [config, setRegistration, setTotals]);

  const promoEntry = usePromoCodeEntry(eventId, (applied: AppliedPromo | null) => {
    if (config) setTotals(calculatePrice(config, registration, applied));
  });

  if (!config) return null;

  const continueSent = () => {
    if (!sentBefore) return;
    setPaymentStep(sentBefore);
    goToStep('payment');
  };

  const startOver = () => {
    clearPaymentStep(storageKey);
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

  const handleChange = (formData: unknown) => {
    const data = formData as RegistrationFormData;
    const nextTotals = calculatePrice(config, data, promo);
    debug('RegistrationStep onChange', { formData: data, totals: nextTotals });
    setUpdating(true);
    setRegistration(data);
    setTotals(nextTotals);
    setUpdating(false);
    debouncedSave(data);
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
          savePaymentStep(storageKey, paymentStep);
          setPaymentStep(paymentStep);
          goToStep('payment');
        },
      },
    );
  };

  // Dev aid: expose the change handler for autofill (SPEC §10).
  if (import.meta.env.DEV) {
    (window as unknown as { regOnChange?: (data: RegistrationFormData) => void }).regOnChange =
      handleChange;
  }

  return (
    // The class lets an event's uiSchema hide fields during registration only (SPEC §7.1).
    <Stack className="camphoric-registration">
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
          <Button type="submit" loading={submit.isPending}>
            Continue to payment
          </Button>
        </Stack>
      </JsonSchemaForm>
      <PriceTicker />
    </Stack>
  );
}

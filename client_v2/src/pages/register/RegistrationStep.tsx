/**
 * Step 1 — the registration form (SPEC §7.1). Renders the data-driven form and,
 * on every change, saves the form data to the store, recomputes the live total
 * with `calculatePrice`, and persists to localStorage (debounced). On mount it
 * rehydrates any saved data. When the event has promo codes, a field above the
 * submit button applies one (repriced live); a code typed but not applied blocks
 * submitting. Submitting posts the registration and advances to the payment step.
 */

import { Alert, Button, Stack } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import type { AppliedPromo, RegistrationFormData } from 'api-types';
import { JsonSchemaForm } from 'components/form';
import { Template } from 'components/templating';
import { useEventId } from 'hooks/useEventId';
import { useGoToStep } from 'hooks/useGoToStep';
import { calculatePrice } from 'pricing';
import { useEffect, useRef } from 'react';
import { useRegistrationStore } from 'store/registration';
import { useRegistrationConfig, useSubmitRegistration } from 'store/registrationApi';
import { debug } from 'utils/debug';
import { formatMoney } from 'utils/money';

import { PriceTicker } from './PriceTicker';
import { PromoCodeEntry, usePromoCodeEntry } from './PromoCodeEntry';
import {
  getRegistrationStorageKey,
  loadRegistrationFormData,
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
      setTotals(calculatePrice(config, saved, undefined, useRegistrationStore.getState().promo));
    }
  }, [config, setRegistration, setTotals]);

  const promoEntry = usePromoCodeEntry(eventId, (applied: AppliedPromo | null) => {
    if (config) setTotals(calculatePrice(config, registration, undefined, applied));
  });

  if (!config) return null;

  const templateData = {
    ...config.templateVars,
    pricing: config.pricing,
    formData: registration,
    totals,
  };

  const handleChange = (formData: unknown) => {
    const data = formData as RegistrationFormData;
    const nextTotals = calculatePrice(config, data, undefined, promo);
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
          {config.event.epayment_handling ? (
            <Alert variant="light" color="blue" title="Handling charge">
              There is a {config.event.epayment_handling}% handling charge (
              {formatMoney(totals.handling ?? 0)}) on electronic payments — pay by check to avoid
              it.
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

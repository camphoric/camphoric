/**
 * Step 1 — the registration form (SPEC §7.1). Renders the data-driven form and,
 * on every change, saves the form data to the store, recomputes the live total
 * with `calculatePrice`, and persists to localStorage (debounced). On mount it
 * rehydrates any saved data. Submitting posts the registration and advances to
 * the payment step.
 */

import { Alert, Button, Stack } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import type { RegistrationFormData } from 'api-types';
import { JsonSchemaForm } from 'components/form';
import { Template } from 'components/templating';
import { useEventId } from 'hooks/useEventId';
import { useGoToStep } from 'hooks/useGoToStep';
import { calculatePrice } from 'pricing';
import { useEffect, useRef } from 'react';
import { useRegistrationStore } from 'store/registration';
import { useRegistrationConfig, useSubmitRegistration } from 'store/registrationApi';
import { formatMoney } from 'utils/money';

import { PriceTicker } from './PriceTicker';
import {
  getRegistrationStorageKey,
  loadRegistrationFormData,
  saveRegistrationFormData,
} from './storage';

interface RjsfError {
  property?: string;
}

/** Map an rjsf error property path (".campers.0.phone") to its field id. */
function errorPropertyToId(property: string): string {
  const parts = property
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  return ['root', ...parts].join('_');
}

export function RegistrationStep() {
  const eventId = useEventId();
  const goToStep = useGoToStep();
  const { data: config } = useRegistrationConfig(eventId);
  const submit = useSubmitRegistration(eventId);

  const registration = useRegistrationStore((state) => state.registration);
  const totals = useRegistrationStore((state) => state.totals);
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
      setTotals(calculatePrice(config, saved));
    }
  }, [config, setRegistration, setTotals]);

  if (!config) return null;

  const templateData = {
    ...config.templateVars,
    pricing: config.pricing,
    formData: registration,
    totals,
  };

  const handleChange = (formData: unknown) => {
    const data = formData as RegistrationFormData;
    setUpdating(true);
    setRegistration(data);
    setTotals(calculatePrice(config, data));
    setUpdating(false);
    debouncedSave(data);
  };

  const handleError = (errors: unknown[]) => {
    // Scroll to the error summary and focus the first problem field (the phone
    // widget in particular needs an explicit focus — SPEC §7.1, §11).
    window.scrollTo(0, 0);
    (errors as RjsfError[]).forEach((error) => {
      if (error.property?.includes('phone')) {
        document.getElementById(errorPropertyToId(error.property))?.focus();
      }
    });
  };

  const handleSubmit = () => {
    submit.mutate(
      {
        formData: registration,
        pricingResults: totals,
        ...(config.invitation ? { invitation: config.invitation } : {}),
      },
      {
        onSuccess: (paymentStep) => {
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
    <Stack>
      <JsonSchemaForm
        schema={config.dataSchema}
        uiSchema={config.uiSchema}
        formData={registration}
        templateData={templateData}
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
          <Button type="submit" loading={submit.isPending}>
            Continue to payment
          </Button>
        </Stack>
      </JsonSchemaForm>
      <PriceTicker />
    </Stack>
  );
}

/**
 * localStorage persistence for the in-progress registration (SPEC §7.1, §7.2,
 * §12). The key is derived from the schema title and the event start date so a
 * registrant's progress survives a reload — but stale data doesn't bleed across
 * events. Once the form is submitted the payment step is saved too, so a reload
 * (or a return after closing a PayPal window) resumes paying for the same
 * registration instead of starting a second one. Both are cleared after
 * confirmation unless the KEEP_REG_DATA debug flag is set.
 */

import type { ApiRegister, ApiRegisterPaymentStep, RegistrationFormData } from 'api-types';

export function getRegistrationStorageKey(config: ApiRegister): string {
  const title = config.dataSchema.title ?? 'formData';
  const start = config.event.start;
  const date = start ? `${start.year}-${start.month}-${start.day}` : '';
  return `${title}, ${date}`;
}

export function saveRegistrationFormData(key: string, formData: RegistrationFormData): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(formData));
  } catch (error) {
    console.error('Failed to save registration form data', error);
  }
}

export function loadRegistrationFormData(key: string): RegistrationFormData | null {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as RegistrationFormData) : null;
  } catch (error) {
    console.error('Failed to read saved registration form data', error);
    return null;
  }
}

export function clearRegistrationFormData(key: string): void {
  // KEEP_REG_DATA preserves the data across confirmation (debugging/autofill).
  if (window.localStorage.getItem('KEEP_REG_DATA')) return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear registration form data', error);
  }
}

const paymentStepKey = (key: string) => `${key} (payment)`;

export function savePaymentStep(key: string, paymentStep: ApiRegisterPaymentStep): void {
  try {
    window.localStorage.setItem(paymentStepKey(key), JSON.stringify(paymentStep));
  } catch (error) {
    console.error('Failed to save the payment step', error);
  }
}

export function loadPaymentStep(key: string): ApiRegisterPaymentStep | null {
  try {
    const saved = window.localStorage.getItem(paymentStepKey(key));
    const parsed = saved ? (JSON.parse(saved) as ApiRegisterPaymentStep) : null;
    // One saved before payment options moved to the server can't be resumed.
    return parsed?.paymentOptions ? parsed : null;
  } catch (error) {
    console.error('Failed to read the saved payment step', error);
    return null;
  }
}

export function clearPaymentStep(key: string): void {
  if (window.localStorage.getItem('KEEP_REG_DATA')) return;
  try {
    window.localStorage.removeItem(paymentStepKey(key));
  } catch (error) {
    console.error('Failed to clear the saved payment step', error);
  }
}

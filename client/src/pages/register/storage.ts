/**
 * localStorage persistence for the in-progress registration (SPEC §7.1, §7.2,
 * §12). The key is derived from the schema title and the event start date so a
 * registrant's progress survives a reload — but stale data doesn't bleed across
 * events. Once the form is submitted, what was sent — the payment step, with the
 * form data and promo code it was sent with — is saved too, so a reload (or a
 * return after closing a PayPal window) resumes paying for the same registration,
 * still showing what was entered, instead of starting a second one. Both are
 * cleared after confirmation unless the KEEP_REG_DATA debug flag is set.
 */

import type { ApiRegister, RegistrationFormData } from 'api-types';
import type { SentRegistration } from 'store/registration';

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

const sentKey = (key: string) => `${key} (payment)`;

export function saveSentRegistration(key: string, sent: SentRegistration): void {
  try {
    window.localStorage.setItem(sentKey(key), JSON.stringify(sent));
  } catch (error) {
    console.error('Failed to save the sent registration', error);
  }
}

export function loadSentRegistration(key: string): SentRegistration | null {
  try {
    const saved = window.localStorage.getItem(sentKey(key));
    const parsed = saved ? (JSON.parse(saved) as Partial<SentRegistration>) : null;
    // One saved as a bare payment step (without the form data it was sent with,
    // or from before payment options moved to the server) can't be resumed.
    return parsed?.paymentStep?.paymentOptions && parsed.formData
      ? { paymentStep: parsed.paymentStep, formData: parsed.formData, promo: parsed.promo ?? null }
      : null;
  } catch (error) {
    console.error('Failed to read the sent registration', error);
    return null;
  }
}

export function clearSentRegistration(key: string): void {
  if (window.localStorage.getItem('KEEP_REG_DATA')) return;
  try {
    window.localStorage.removeItem(sentKey(key));
  } catch (error) {
    console.error('Failed to clear the sent registration', error);
  }
}

/**
 * localStorage persistence for the in-progress registration (SPEC §7.1, §12).
 * The key is derived from the schema title and the event start date so a
 * registrant's progress survives a reload — but stale data doesn't bleed across
 * events. Cleared after confirmation unless the KEEP_REG_DATA debug flag is set.
 */

import type { ApiRegister, RegistrationFormData } from 'api-types';

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

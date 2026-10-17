/**
 * localStorage persistence for the in-progress registration (SPEC §7.1, §7.2,
 * §12). The key is derived from the event id, schema title and event start date
 * so a registrant's progress survives a reload — but stale data doesn't bleed
 * across events, even two with the same title and dates. Once the form is
 * submitted, what was sent — the payment step, with the form data and promo code
 * it was sent with — is saved too, so a reload (or a return after closing a
 * PayPal window) resumes paying for the same registration, still showing what
 * was entered, instead of starting a second one. Both are cleared after
 * confirmation unless the KEEP_REG_DATA debug flag is set. Every storage access
 * is guarded: with site data blocked, reading `window.localStorage` throws, and
 * that mustn't break the page.
 *
 * Data saved before the key carried the event id sits under the same key minus
 * its `Event <id>: ` prefix (the legacy key), which two events with the same
 * title and dates shared. Saved form data falls back to it, moving to the new
 * key once read; a sent registration under it is only offered through
 * {@link loadLegacySentRegistration}, for the caller to check with the server
 * before adopting it. Clearing a key clears its legacy form data too, and its
 * legacy sent registration when that's the same registration.
 */

import type { ApiRegister, RegistrationFormData } from 'api-types';
import type { SentRegistration } from 'store/registration';

export function getRegistrationStorageKey(eventId: string, config: ApiRegister): string {
  const title = config.dataSchema.title ?? 'formData';
  const start = config.event.start;
  const date = start ? `${start.year}-${start.month}-${start.day}` : '';
  return `Event ${eventId}: ${title}, ${date}`;
}

/** The key without its event id, as it was saved under before (or null when there isn't one). */
function legacyKey(key: string): string | null {
  const legacy = key.replace(/^Event [^:]*: /, '');
  return legacy === key ? null : legacy;
}

/** The KEEP_REG_DATA debug flag preserves the data across confirmation (debugging/autofill). */
function keepRegData(): boolean {
  return Boolean(window.localStorage.getItem('KEEP_REG_DATA'));
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
    let saved = window.localStorage.getItem(key);
    const legacy = legacyKey(key);
    if (saved === null && legacy !== null) {
      // Saved under the legacy key: move it to this one.
      saved = window.localStorage.getItem(legacy);
      if (saved !== null) {
        window.localStorage.setItem(key, saved);
        window.localStorage.removeItem(legacy);
      }
    }
    return saved ? (JSON.parse(saved) as RegistrationFormData) : null;
  } catch (error) {
    console.error('Failed to read saved registration form data', error);
    return null;
  }
}

export function clearRegistrationFormData(key: string): void {
  try {
    if (keepRegData()) return;
    window.localStorage.removeItem(key);
    const legacy = legacyKey(key);
    if (legacy !== null) window.localStorage.removeItem(legacy);
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
  try {
    if (keepRegData()) return;
    // The legacy one goes too, but only if it's the same registration: another
    // event with the same title and dates may have saved it.
    const uuid = loadSentRegistration(key)?.paymentStep.registrationUUID;
    const legacy = legacyKey(key);
    if (
      uuid &&
      legacy !== null &&
      loadSentRegistration(legacy)?.paymentStep.registrationUUID === uuid
    ) {
      window.localStorage.removeItem(sentKey(legacy));
    }
    window.localStorage.removeItem(sentKey(key));
  } catch (error) {
    console.error('Failed to clear the sent registration', error);
  }
}

/**
 * The sent registration saved under the legacy key, if any. Another event with
 * the same title and dates may have saved it, so check with the server that
 * it's this event's before {@link adoptLegacySentRegistration}.
 */
export function loadLegacySentRegistration(key: string): SentRegistration | null {
  const legacy = legacyKey(key);
  return legacy === null ? null : loadSentRegistration(legacy);
}

/** Saves a sent registration the server confirmed as this event's under this key, dropping the legacy one. */
export function adoptLegacySentRegistration(key: string, sent: SentRegistration): void {
  saveSentRegistration(key, sent);
  const legacy = legacyKey(key);
  if (legacy === null) return;
  try {
    window.localStorage.removeItem(sentKey(legacy));
  } catch (error) {
    console.error('Failed to clear the legacy sent registration', error);
  }
}

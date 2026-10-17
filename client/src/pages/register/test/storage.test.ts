import { makeRegisterConfig } from 'test/fixtures';
import { afterEach, describe, expect, it } from 'vitest';

import {
  clearRegistrationFormData,
  clearSentRegistration,
  getRegistrationStorageKey,
  loadRegistrationFormData,
  loadSentRegistration,
  saveRegistrationFormData,
  saveSentRegistration,
} from '../storage';

const config = makeRegisterConfig({
  dataSchema: { title: 'Summer Camp' },
  event: { is_open: true, start: { epoch: 0, year: 2026, month: 7, day: 1 } },
});

afterEach(() => {
  localStorage.clear();
});

describe('registration storage', () => {
  it('keys on the schema title and event start date', () => {
    expect(getRegistrationStorageKey(config)).toBe('Summer Camp, 2026-7-1');
  });

  it('round-trips form data', () => {
    const key = getRegistrationStorageKey(config);
    saveRegistrationFormData(key, { campers: [{ name: 'Bob' }] });
    expect(loadRegistrationFormData(key)).toEqual({ campers: [{ name: 'Bob' }] });
  });

  it('returns null when nothing is saved', () => {
    expect(loadRegistrationFormData('missing')).toBeNull();
  });

  it('clears saved data', () => {
    const key = getRegistrationStorageKey(config);
    saveRegistrationFormData(key, { campers: [{}] });
    clearRegistrationFormData(key);
    expect(loadRegistrationFormData(key)).toBeNull();
  });

  it('keeps data when the KEEP_REG_DATA flag is set', () => {
    const key = getRegistrationStorageKey(config);
    saveRegistrationFormData(key, { campers: [{}] });
    localStorage.setItem('KEEP_REG_DATA', '1');
    clearRegistrationFormData(key);
    expect(loadRegistrationFormData(key)).not.toBeNull();
  });

  describe('the sent registration', () => {
    const sent = {
      paymentStep: {
        registrationUUID: 'u',
        serverPricingResults: { total: 100, campers: [] },
        paymentOptions: { title: '', description: '', default: 'Full', options: [] },
        handlingPercent: null,
      },
      formData: { campers: [{ first_name: 'Pat' }] },
      promo: {
        code: 'EARLY',
        label: 'Early bird',
        scope: 'registration' as const,
        pricingLogic: null,
      },
    };

    it('round-trips the payment step with the form data and promo it was sent with', () => {
      saveSentRegistration('k', sent);
      expect(loadSentRegistration('k')).toEqual(sent);
    });

    it('ignores one saved as a bare payment step', () => {
      localStorage.setItem('k (payment)', JSON.stringify(sent.paymentStep));
      expect(loadSentRegistration('k')).toBeNull();
    });

    it('clears it', () => {
      saveSentRegistration('k', sent);
      clearSentRegistration('k');
      expect(loadSentRegistration('k')).toBeNull();
    });
  });
});

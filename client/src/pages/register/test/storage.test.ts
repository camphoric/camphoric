import { makeRegisterConfig } from 'test/fixtures';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
} from '../storage';

const config = makeRegisterConfig({
  dataSchema: { title: 'Summer Camp' },
  event: { is_open: true, start: { epoch: 0, year: 2026, month: 7, day: 1 } },
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('registration storage', () => {
  it('keys on the event id, schema title and event start date', () => {
    expect(getRegistrationStorageKey('1', config)).toBe('Event 1: Summer Camp, 2026-7-1');
  });

  it('keeps two events with the same title and dates apart', () => {
    saveRegistrationFormData(getRegistrationStorageKey('2', config), {
      campers: [{ name: 'Bob' }],
    });
    expect(loadRegistrationFormData(getRegistrationStorageKey('3', config))).toBeNull();
  });

  describe('data saved under the legacy key (without the event id)', () => {
    const LEGACY = 'Summer Camp, 2026-7-1';
    const key = getRegistrationStorageKey('4', config);

    it('falls back to its form data, moving it to the new key', () => {
      localStorage.setItem(LEGACY, JSON.stringify({ campers: [{ name: 'Bob' }] }));
      expect(loadRegistrationFormData(key)).toEqual({ campers: [{ name: 'Bob' }] });
      expect(localStorage.getItem(LEGACY)).toBeNull();
      expect(localStorage.getItem(key)).toBe(JSON.stringify({ campers: [{ name: 'Bob' }] }));
    });

    it('prefers form data under the new key', () => {
      localStorage.setItem(LEGACY, JSON.stringify({ campers: [{ name: 'Old' }] }));
      saveRegistrationFormData(key, { campers: [{ name: 'New' }] });
      expect(loadRegistrationFormData(key)).toEqual({ campers: [{ name: 'New' }] });
    });

    it('has its form data cleared with the new key', () => {
      localStorage.setItem(LEGACY, '{"campers":[{}]}');
      clearRegistrationFormData(key);
      expect(localStorage.getItem(LEGACY)).toBeNull();
    });
  });

  it('never throws when site data is blocked', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Access is denied', 'SecurityError');
    });

    const key = getRegistrationStorageKey('6', config);
    expect(key).toBe('Event 6: Summer Camp, 2026-7-1');
    expect(() => saveRegistrationFormData(key, { campers: [{}] })).not.toThrow();
    expect(loadRegistrationFormData(key)).toBeNull();
    expect(() => clearRegistrationFormData(key)).not.toThrow();
    expect(loadSentRegistration(key)).toBeNull();
    expect(() => clearSentRegistration(key)).not.toThrow();
  });

  it('round-trips form data', () => {
    const key = getRegistrationStorageKey('1', config);
    saveRegistrationFormData(key, { campers: [{ name: 'Bob' }] });
    expect(loadRegistrationFormData(key)).toEqual({ campers: [{ name: 'Bob' }] });
  });

  it('returns null when nothing is saved', () => {
    expect(loadRegistrationFormData('missing')).toBeNull();
  });

  it('clears saved data', () => {
    const key = getRegistrationStorageKey('1', config);
    saveRegistrationFormData(key, { campers: [{}] });
    clearRegistrationFormData(key);
    expect(loadRegistrationFormData(key)).toBeNull();
  });

  it('keeps data when the KEEP_REG_DATA flag is set', () => {
    const key = getRegistrationStorageKey('1', config);
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

    it('offers one under the legacy key only on request, and moves it when adopted', () => {
      const key = getRegistrationStorageKey('9', config);
      saveSentRegistration('Summer Camp, 2026-7-1', sent);
      expect(loadSentRegistration(key)).toBeNull();
      expect(loadLegacySentRegistration(key)).toEqual(sent);

      adoptLegacySentRegistration(key, sent);
      expect(loadSentRegistration(key)).toEqual(sent);
      expect(loadLegacySentRegistration(key)).toBeNull();
    });

    it('clears one under the legacy key with it only when it’s the same registration', () => {
      const key = getRegistrationStorageKey('10', config);
      const other = { ...sent, paymentStep: { ...sent.paymentStep, registrationUUID: 'other' } };

      saveSentRegistration(key, sent);
      saveSentRegistration('Summer Camp, 2026-7-1', other);
      clearSentRegistration(key);
      expect(loadSentRegistration(key)).toBeNull();
      expect(loadLegacySentRegistration(key)).toEqual(other);

      saveSentRegistration(key, sent);
      saveSentRegistration('Summer Camp, 2026-7-1', sent);
      clearSentRegistration(key);
      expect(loadLegacySentRegistration(key)).toBeNull();
    });

    it('clears it', () => {
      saveSentRegistration('k', sent);
      clearSentRegistration('k');
      expect(loadSentRegistration('k')).toBeNull();
    });
  });
});

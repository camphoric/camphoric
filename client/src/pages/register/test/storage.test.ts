import { makeRegisterConfig } from 'test/fixtures';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it('ignores data saved under the key without the event id', () => {
    localStorage.setItem('Summer Camp, 2026-7-1', JSON.stringify({ campers: [{ name: 'Bob' }] }));
    expect(loadRegistrationFormData(getRegistrationStorageKey('4', config))).toBeNull();
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

    it('clears it', () => {
      saveSentRegistration('k', sent);
      clearSentRegistration('k');
      expect(loadSentRegistration('k')).toBeNull();
    });
  });
});

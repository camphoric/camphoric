import { makeRegisterConfig } from 'test/fixtures';
import { afterEach, describe, expect, it } from 'vitest';

import {
  clearRegistrationFormData,
  getRegistrationStorageKey,
  loadRegistrationFormData,
  saveRegistrationFormData,
} from './storage';

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
});

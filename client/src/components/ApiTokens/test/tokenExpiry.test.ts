import { describe, expect, it } from 'vitest';

import { expiresAtFor, expiryOptions, expiryProblem, latestExpiry } from '../tokenExpiry';

const NOW = new Date('2026-11-06T12:00:00Z');

describe('expiryOptions', () => {
  it('offers days, a date of your own, and never, when there’s no cap', () => {
    expect(expiryOptions(null).map((option) => option.value)).toEqual([
      '7',
      '30',
      '90',
      'date',
      'never',
    ]);
  });

  it('offers no more days than the cap, the cap itself, and not never', () => {
    expect(expiryOptions(30).map((option) => option.label)).toEqual([
      'In 7 days',
      'In 30 days',
      'On a date and time you choose',
    ]);
    expect(expiryOptions(14).map((option) => option.value)).toEqual(['7', '14', 'date']);
    expect(expiryOptions(1).map((option) => option.label)).toEqual([
      'In 1 day',
      'On a date and time you choose',
    ]);
  });
});

describe('expiresAtFor', () => {
  it('counts days from now, takes the date chosen, and sends null for never', () => {
    expect(expiresAtFor('30', null, null, NOW)).toBe('2026-12-06T12:00:00.000Z');
    expect(expiresAtFor('30', null, 90, NOW)).toBe('2026-12-06T12:00:00.000Z');
    expect(expiresAtFor('date', '2026-11-07T08:00:00.000Z', null, NOW)).toBe(
      '2026-11-07T08:00:00.000Z',
    );
    expect(expiresAtFor('never', null, null, NOW)).toBeNull();
  });

  it('stops the cap’s own choice a little short of it, for a clock that runs ahead', () => {
    expect(expiresAtFor('30', null, 30, NOW)).toBe('2026-12-06T11:50:00.000Z');
  });
});

describe('expiryProblem', () => {
  it('refuses a time already past', () => {
    expect(expiryProblem('2026-11-06T11:59:00Z', null, NOW)).toMatch(/still to come/);
  });

  it('refuses a time past the cap, and takes one within it', () => {
    expect(expiryProblem('2026-11-14T12:00:00Z', 7, NOW)).toBe('A token may last at most 7 days.');
    expect(expiryProblem('2026-11-13T11:50:00Z', 7, NOW)).toBeNull();
    expect(expiryProblem('2026-11-13T11:55:00Z', 7, NOW)).not.toBeNull();
    expect(expiryProblem('2030-01-01T00:00:00Z', null, NOW)).toBeNull();
  });

  it('knows the latest allowed', () => {
    expect(latestExpiry(7, NOW)?.toISOString()).toBe('2026-11-13T11:50:00.000Z');
    expect(latestExpiry(null, NOW)).toBeNull();
  });
});

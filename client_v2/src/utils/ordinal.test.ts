import { describe, expect, it } from 'vitest';

import { ordinal } from './ordinal';

describe('ordinal', () => {
  it('formats the common ordinals', () => {
    expect(['x', ...Array.from({ length: 5 }, (_, i) => ordinal(i + 1))]).toEqual([
      'x',
      '1st',
      '2nd',
      '3rd',
      '4th',
      '5th',
    ]);
  });

  it('handles the 11–13 exceptions', () => {
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(22)).toBe('22nd');
    expect(ordinal(23)).toBe('23rd');
  });
});

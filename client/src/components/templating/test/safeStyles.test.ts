import { describe, expect, it } from 'vitest';

import { safeStyle } from '../safeStyles';

describe('safeStyle (SPEC §9.3, DR-132)', () => {
  it('keeps color, type and text alignment', () => {
    expect(safeStyle('color: red; font-size: 2rem; font-weight: bold')).toBe(
      'color: red; font-size: 2rem; font-weight: bold',
    );
    expect(safeStyle('background-color: rgb(255, 240, 200);text-align:center')).toBe(
      'background-color: rgb(255, 240, 200); text-align: center',
    );
  });

  it('drops what could draw over the page', () => {
    expect(
      safeStyle('position: fixed; inset: 0; z-index: 9999; color: red; margin-top: -500px'),
    ).toBe('color: red');
    expect(safeStyle('transform: translateY(-100px); width: 100vw; height: 100vh')).toBe('');
  });

  it('drops values that load or smuggle anything in', () => {
    expect(safeStyle('background-color: url(https://example.com/x.png)')).toBe('');
    expect(safeStyle('background-color: url(x)')).toBe('');
    expect(safeStyle('color: expression(alert(1))')).toBe('');
    expect(safeStyle('color: red !important')).toBe('');
    expect(safeStyle('color: re\\64')).toBe('');
    expect(safeStyle('color: red /* position: fixed */')).toBe('');
    expect(safeStyle('color: "red"')).toBe('');
  });

  it('matches properties exactly, ignoring case', () => {
    expect(safeStyle('COLOR: Red')).toBe('color: Red');
    expect(safeStyle('-webkit-transform: none; po\\73 ition: fixed')).toBe('');
  });

  it('ignores declarations without a value', () => {
    expect(safeStyle('color; ; font-style: italic;')).toBe('font-style: italic');
  });
});

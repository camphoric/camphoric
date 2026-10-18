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

  it('keeps a text decoration without a thickness', () => {
    expect(safeStyle('text-decoration: underline')).toBe('text-decoration: underline');
    expect(safeStyle('text-decoration: line-through')).toBe('text-decoration: line-through');
    expect(safeStyle('text-decoration: underline wavy red')).toBe(
      'text-decoration: underline wavy red',
    );
    expect(safeStyle('text-decoration: overline dotted #c00')).toBe(
      'text-decoration: overline dotted #c00',
    );
    expect(safeStyle('text-decoration: underline rgb(200, 0, 0)')).toBe(
      'text-decoration: underline rgb(200, 0, 0)',
    );
    expect(safeStyle('text-decoration: overline black 400px')).toBe('');
    expect(safeStyle('text-decoration: underline 50%')).toBe('');
    expect(safeStyle('text-decoration: underline 2em solid')).toBe('');
  });

  it('keeps a font size up to about four times the body text', () => {
    expect(safeStyle('font-size: 2rem')).toBe('font-size: 2rem');
    expect(safeStyle('font-size: 4rem')).toBe('font-size: 4rem');
    expect(safeStyle('font-size: 72px')).toBe('font-size: 72px');
    expect(safeStyle('font-size: 0.8rem')).toBe('font-size: 0.8rem');
    expect(safeStyle('font-size: xx-large')).toBe('font-size: xx-large');
    expect(safeStyle('font-size: 4.5rem')).toBe('');
    expect(safeStyle('font-size: 40000px')).toBe('');
    expect(safeStyle('font-size: 100vw')).toBe('');
    expect(safeStyle('font-size: 10vh')).toBe('');
  });

  it('refuses font sizes relative to the parent, which nesting would multiply', () => {
    expect(safeStyle('font-size: 2em')).toBe('');
    expect(safeStyle('font-size: 150%')).toBe('');
    expect(safeStyle('font-size: larger')).toBe('');
  });

  it('matches properties exactly, ignoring case', () => {
    expect(safeStyle('COLOR: Red')).toBe('color: Red');
    expect(safeStyle('-webkit-transform: none; po\\73 ition: fixed')).toBe('');
  });

  it('ignores declarations without a value', () => {
    expect(safeStyle('color; ; font-style: italic;')).toBe('font-style: italic');
  });
});

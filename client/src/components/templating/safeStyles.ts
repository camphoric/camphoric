/**
 * The CSS a template may write in a `style` attribute (SPEC §9.3; §15, DR-132):
 * color, type and text alignment, which change how text looks but can't lift a
 * box out of the page. Positioning, sizing, margins and transforms are dropped,
 * so templated text can't draw over the page around it (a fake button or a
 * cover over the real form). The sanitizer's class allowlist (pipeline.ts)
 * closes the other way in, the app's own positioned classes.
 */

import type { Element, Root } from 'hast';

const ALLOWED_PROPERTIES = new Set([
  'background-color',
  'color',
  'font-size',
  'font-style',
  'font-variant',
  'font-weight',
  'text-align',
  'text-decoration',
  'text-transform',
]);

/**
 * Words, numbers, units, `#` colors and parentheses only: no quotes, slashes,
 * backslashes (CSS escapes), `!important` or anything else that could smuggle
 * another declaration or a comment in.
 */
const SAFE_VALUE = /^[\w\s#%.,()+-]+$/;

/** The CSS functions a value may call: colors. `url()` and the rest are refused. */
const ALLOWED_FUNCTIONS = new Set(['hsl', 'hsla', 'rgb', 'rgba']);

function isSafeValue(value: string): boolean {
  if (!SAFE_VALUE.test(value)) return false;
  const functionNames = value.match(/[\w-]+(?=\s*\()/g) ?? [];
  return functionNames.every((name) => ALLOWED_FUNCTIONS.has(name.toLowerCase()));
}

/** The declarations of `style` that are on the allowlist, in order; '' for none. */
export function safeStyle(style: string): string {
  return style
    .split(';')
    .flatMap((declaration) => {
      const colon = declaration.indexOf(':');
      if (colon < 0) return [];
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      return ALLOWED_PROPERTIES.has(property) && isSafeValue(value) ? [`${property}: ${value}`] : [];
    })
    .join('; ');
}

/** A rehype step, run after sanitizing, that keeps only safe CSS in each `style`. */
export function rehypeSafeStyles() {
  const filterStyles = (parent: Root | Element) => {
    parent.children.forEach((child) => {
      if (child.type !== 'element') return;
      const { style } = child.properties;
      if (style !== undefined) {
        const kept = safeStyle(String(style));
        if (kept) child.properties.style = kept;
        else delete child.properties.style;
      }
      filterStyles(child);
    });
  };
  return filterStyles;
}

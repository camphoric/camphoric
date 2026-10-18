/**
 * The CSS a template may write in a `style` attribute (SPEC §9.3; §15, DR-132):
 * color, type and text alignment, which change how text looks but can't lift a
 * box out of the page; font sizes are capped, and a text decoration takes no
 * thickness. Positioning, sizing, margins and transforms are dropped,
 * so templated text can't draw over the page around it (a fake button or a
 * cover over the real form). The sanitizer's class allowlist (pipeline.ts)
 * closes the other way in, the app's own positioned classes.
 */

import type { Element, Root } from 'hast';

/**
 * Words, numbers, units, `#` colors and parentheses only: no quotes, slashes,
 * backslashes (CSS escapes), `!important` or anything else that could smuggle
 * another declaration or a comment in.
 */
const SAFE_VALUE = /^[\w\s#%.,()+-]+$/;

/** The CSS functions a value may call: colors. `url()` and the rest are refused. */
const ALLOWED_FUNCTIONS = new Set(['hsl', 'hsla', 'rgb', 'rgba']);

const COLOR_FUNCTION = /\b(?:rgba?|hsla?)\([^()]*\)/gi;

const KEYWORD = /^[a-z]+(?:-[a-z]+)*$/i;
const HEX_COLOR = /^#[\da-f]{3,8}$/i;

/**
 * A value made only of keywords (such as `line-through`) or named colors, `#`
 * colors and color functions: no number outside a color, so no length — the
 * thickness of a `text-decoration` could otherwise paint a bar of any size
 * over the page.
 */
function isKeywordsAndColors(value: string): boolean {
  return value
    .replace(COLOR_FUNCTION, ' ')
    .trim()
    .split(/\s+/)
    .every((token) => token === '' || KEYWORD.test(token) || HEX_COLOR.test(token));
}

/**
 * The absolute font-size keywords. `smaller` and `larger`, like em and %, are
 * relative to the parent's size, so nesting them would multiply past any cap.
 */
const FONT_SIZE_KEYWORDS = new Set([
  'xx-small',
  'x-small',
  'small',
  'medium',
  'large',
  'x-large',
  'xx-large',
  'xxx-large',
]);

/** The largest font size in each unit allowed: about four times the body text. */
const FONT_SIZE_LIMITS: Record<string, number> = { px: 72, rem: 4 };

/** An absolute font-size keyword, or a px/rem size up to FONT_SIZE_LIMITS. */
function isModestFontSize(value: string): boolean {
  if (FONT_SIZE_KEYWORDS.has(value.toLowerCase())) return true;
  const match = /^(\d+(?:\.\d+)?|\.\d+)(px|rem)$/i.exec(value);
  if (!match) return false;
  return Number(match[1]) <= FONT_SIZE_LIMITS[match[2].toLowerCase()];
}

/**
 * The properties allowed, each with any check of its own on top of SAFE_VALUE
 * and ALLOWED_FUNCTIONS: the ones whose size could reach past their text.
 */
const ALLOWED_PROPERTIES = new Map<string, ((value: string) => boolean) | null>([
  ['background-color', null],
  ['color', null],
  ['font-size', isModestFontSize],
  ['font-style', null],
  ['font-variant', null],
  ['font-weight', null],
  ['text-align', null],
  ['text-decoration', isKeywordsAndColors],
  ['text-transform', null],
]);

function isSafeDeclaration(property: string, value: string): boolean {
  if (!ALLOWED_PROPERTIES.has(property) || !SAFE_VALUE.test(value)) return false;
  const functionNames = value.match(/[\w-]+(?=\s*\()/g) ?? [];
  if (!functionNames.every((name) => ALLOWED_FUNCTIONS.has(name.toLowerCase()))) return false;
  const propertyCheck = ALLOWED_PROPERTIES.get(property);
  return !propertyCheck || propertyCheck(value);
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
      return isSafeDeclaration(property, value) ? [`${property}: ${value}`] : [];
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

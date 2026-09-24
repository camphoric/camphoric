/**
 * After a failed submit, take the registrant to the first problem (SPEC §7.1):
 * focus the first field *on the page* that shows an error and scroll it into
 * the middle of the screen.
 *
 * rjsf's own `focusOnFirstError` isn't enough: it only tries the first error
 * in the validator's order (which may be one hidden as noise, or further down
 * the page), and only finds real inputs by exact id — an error on
 * `lodging_requested.id` has no input of its own. Here each visible error is
 * mapped to its field's element by rjsf's id scheme (`root_campers_0_phone`),
 * walking up the path until an element exists (so the lodging error lands on
 * the lodging picker), and the earliest in document order wins.
 */

import type { RJSFValidationError } from '@rjsf/utils';

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])';

/** `.campers.0.lodging.lodging_requested.id` → the ids to try, most specific first. */
function candidateIds(property: string | undefined): string[] {
  const parts = (property ?? '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  const ids: string[] = [];
  for (let length = parts.length; length > 0; length -= 1) {
    ids.push(['root', ...parts.slice(0, length)].join('_'));
  }
  return ids;
}

function elementFor(container: ParentNode, error: RJSFValidationError): HTMLElement | undefined {
  for (const id of candidateIds(error.property)) {
    const element = container.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
    if (element) return element;
  }
  return undefined;
}

/**
 * The element itself if it can take focus; else, inside a composite field, the
 * control marked invalid (the lodging picker marks its unfinished dropdown),
 * else its first focusable control.
 */
function focusTarget(element: HTMLElement): HTMLElement {
  if (element.matches(FOCUSABLE)) return element;
  const controls = [...element.querySelectorAll<HTMLElement>(FOCUSABLE)];
  return (
    controls.find((control) => control.getAttribute('aria-invalid') === 'true') ??
    controls[0] ??
    element
  );
}

/**
 * Focus and scroll to the first field (in page order) with a visible error.
 * Errors blanked as noise (empty message) are skipped. Returns the focused
 * element, if any.
 */
export function focusFirstError(
  container: ParentNode | null,
  errors: RJSFValidationError[],
): HTMLElement | undefined {
  if (!container) return undefined;
  const elements = errors
    .filter((error) => error.message)
    .map((error) => elementFor(container, error))
    .filter((element): element is HTMLElement => Boolean(element));
  const first = elements.reduce<HTMLElement | undefined>(
    (earliest, element) =>
      !earliest || element.compareDocumentPosition(earliest) & Node.DOCUMENT_POSITION_FOLLOWING
        ? element
        : earliest,
    undefined,
  );
  if (!first) return undefined;
  const target = focusTarget(first);
  // Centre it: the price ticker is pinned to the bottom of the screen.
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  target.focus({ preventScroll: true });
  return target;
}

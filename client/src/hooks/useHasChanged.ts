/**
 * Whether `value` differs from the one the last render saw (true on the first
 * render too), by `Object.is`. For a form that starts afresh as it opens or
 * switches records: it resets its state during render when this is true,
 * rather than in an effect after a render with the old state (react.dev,
 * "Adjusting some state when a prop changes").
 */

import { useState } from 'react';

export function useHasChanged(value: unknown): boolean {
  const [seen, setSeen] = useState<{ value: unknown } | null>(null);
  const changed = seen === null || !Object.is(seen.value, value);
  if (changed) setSeen({ value });
  return changed;
}

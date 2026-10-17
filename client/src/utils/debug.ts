/**
 * Opt-in debug logging (SPEC §10). `debug(...)` is a `console.log` that only
 * prints when the `DEBUG` localStorage flag is set — in any environment — so
 * registrants' consoles stay quiet while a developer can switch tracing on
 * from the browser console with `localStorage.setItem('DEBUG', '1')` (and off
 * with `localStorage.removeItem('DEBUG')`), including on a deployed site.
 */

export function isDebugEnabled(): boolean {
  try {
    return Boolean(window.localStorage.getItem('DEBUG'));
  } catch {
    // localStorage can be unavailable (privacy modes, sandboxed frames).
    return false;
  }
}

export function debug(...args: Parameters<typeof console.log>): void {
  if (isDebugEnabled()) console.log(...args);
}

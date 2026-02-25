/**
 * Debug functions
 *
 * These functions are used to console.log when in development only.
 */

export default function debug(...args: Parameters<typeof console.log>) {
  if (import.meta.env.DEV) return console.log(...args);

  if (localStorage.getItem('DEBUG')) return console.log(...args);
}


/**
 * Debug functions
 *
 * These functions are used to console.log when in development only.
 */

export default function debug(...args: Parameters<typeof console.log>) {
  if (import.meta.env.DEV || localStorage.getItem('DEBUG')) {
    console.log(...args);
  }
}


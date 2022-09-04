/**
 * Debug functions
 *
 * These functions are used to console.log when in development only.
 */

// @ts-ignore
export default function debug(...args) {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
}


/**
 * CSRF token handling. The backend sets a `csrftoken` cookie at bootstrap
 * (GET /api/set-csrf-cookie); every mutating request must echo it back in the
 * X-CSRFToken header (SPEC §3, §10).
 */

export function getCsrfToken(): string {
  const match = document.cookie.match(/\bcsrftoken=([^;]+)/);
  return (match && match[1]) || '';
}

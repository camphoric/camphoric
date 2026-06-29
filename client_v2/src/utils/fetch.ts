/**
 * Shared fetch wrapper for the JSON API. Always sends credentials (cookies) and
 * attaches the CSRF token to mutating requests. The two logical API roots —
 * admin (/api) and public registration (/api/events) — both go through here
 * (SPEC §5, §10).
 *
 * Note: DRF CRUD routes require a trailing slash; callers pass the full path.
 */

import { getCsrfToken } from 'utils/csrf';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown,
  ) {
    super(`API ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (MUTATING_METHODS.has(method)) {
    headers['X-CSRFToken'] = getCsrfToken();
  }

  const response = await fetch(path, {
    method,
    credentials: 'include',
    signal: options.signal,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = await parseBody(response);

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText, payload);
  }

  return payload as T;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Some endpoints (e.g. report render) may return non-JSON; hand back text.
    return text;
  }
}

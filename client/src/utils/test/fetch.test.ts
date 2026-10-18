import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiFetch } from '../fetch';

function answer(status: number, headers: Record<string, string> = {}) {
  vi.stubGlobal('fetch', () =>
    Promise.resolve(
      new Response(JSON.stringify({ detail: 'no' }), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
      }),
    ),
  );
}

async function failure(): Promise<ApiError> {
  try {
    await apiFetch('/api/login', { method: 'POST', body: {} });
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('apiFetch resolved');
}

describe('apiFetch errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('carry the seconds a throttled response asks to wait', async () => {
    answer(429, { 'Retry-After': '42' });
    const error = await failure();
    expect(error.status).toBe(429);
    expect(error.retryAfter).toBe(42);
  });

  it('have no wait without a Retry-After in seconds', async () => {
    answer(400);
    expect((await failure()).retryAfter).toBeNull();
    answer(429, { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' });
    expect((await failure()).retryAfter).toBeNull();
  });
});

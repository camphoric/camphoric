/**
 * CamphoricFetcher, against a stand-in for the global fetch: no server needed.
 */

import { afterEach, describe, expect, test } from '@jest/globals';

import CamphoricFetcher from '../CamphoricFetcher.ts';

const realFetch = globalThis.fetch;

// A fetcher that already has its token, answering every request with `response`
function fetcherAnswering(response: Response) {
  globalThis.fetch = async () => response;
  const fetcher = new CamphoricFetcher('http://camphoric.test');
  fetcher.token = 'token';
  return fetcher;
}

describe('CamphoricFetcher.fetch', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  // Re-importing an event deletes its lodging first, which the server answers
  // with 204 and no body.
  test('resolves an empty (204) response to nothing', async () => {
    const fetcher = fetcherAnswering(new Response(null, { status: 204 }));
    await expect(fetcher.fetch('DELETE', '/api/lodgings/1/')).resolves.toBeUndefined();
  });

  test('resolves a JSON response to its body, with the response attached', async () => {
    const response = Response.json([{ id: 1 }]);
    const fetcher = fetcherAnswering(response);
    const body = await fetcher.fetch('GET', '/api/lodgings/');
    expect([...body]).toEqual([{ id: 1 }]);
    expect(body.response).toBe(response);
  });

  // An event module with no event mustn't hide its validation errors
  test('names no event in its errors when it has none', () => {
    const fetcher = new CamphoricFetcher('http://camphoric.test');
    fetcher.data = {} as never;
    expect(fetcher.error('bad data').eventName).toBe('NoEventSet');
  });

  test('rejects a response with an error status', async () => {
    const fetcher = fetcherAnswering(Response.json({ detail: 'nope' }, { status: 400 }));
    await expect(fetcher.fetch('GET', '/api/lodgings/')).rejects.toThrow('server responded 400');
  });
});

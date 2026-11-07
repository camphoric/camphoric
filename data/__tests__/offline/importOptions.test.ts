/**
 * The importer's options: development environments import, when they start,
 * only into a server with no events (--if-empty), once it answers (--wait);
 * a run with a token minted for it revokes it when it ends (--revoke-token).
 */

import { describe, expect, test } from '@jest/globals';

import { importOptions, serverEventNames, waitForServer } from '../../importOptions.ts';

// A stand-in for the server's events list, answering `body`, as `user`
// (GET /api/user) sees it
const serverWith = (
  body: unknown,
  status = 200,
  user: unknown = { username: 'admin', pending_contract_organizations: [] },
) => (async (url: string | URL | Request, init?: RequestInit) => {
  expect(init?.headers).toEqual({ Authorization: 'Bearer secret' });
  if (String(url) === 'http://camphoric.test/api/user') return Response.json(user);
  expect(String(url)).toBe('http://camphoric.test/api/events/');
  return Response.json(body, { status });
}) as typeof fetch;

describe('importOptions', () => {
  test('imports every event, at once, by default', () => {
    expect(importOptions([])).toEqual({ ifEmpty: false, wait: false, revokeToken: false });
  });

  test('takes --if-empty, --wait and --revoke-token', () => {
    expect(importOptions(['--wait', '--revoke-token', '--if-empty']))
      .toEqual({ ifEmpty: true, wait: true, revokeToken: true });
  });

  test('refuses an option it doesn\'t know', () => {
    expect(() => importOptions(['--if-emtpy'])).toThrow('unknown option --if-emtpy');
  });
});

describe('serverEventNames', () => {
  test('names the events the server has', async () => {
    await expect(serverEventNames('http://camphoric.test', 'secret', serverWith([{ id: 1, name: 'Camp' }])))
      .resolves.toEqual(new Set(['Camp']));
  });

  test('fails rather than guess when the server won\'t list its events', async () => {
    await expect(serverEventNames('http://camphoric.test', 'secret', serverWith({ detail: 'no' }, 403)))
      .rejects.toThrow('couldn\'t list the server\'s events (403)');
  });

  // e.g. a paginated list: reading it as no events would import over them
  test('fails on a list it doesn\'t understand', async () => {
    await expect(serverEventNames('http://camphoric.test', 'secret', serverWith({ count: 1, results: [] })))
      .rejects.toThrow('isn\'t a list');
  });

  // The server leaves those organizations' events out of the list, which
  // could then read as no events
  test('fails when the token\'s user has terms to agree to', async () => {
    const pending = serverWith([], 200, { username: 'admin', pending_contract_organizations: [3, 5] });
    await expect(serverEventNames('http://camphoric.test', 'secret', pending)).rejects.toThrow(
      'admin has yet to agree to the terms of organizations 3, 5 (by id), whose events the server leaves out',
    );
  });

  test('fails when the server doesn\'t say whether there are terms to agree to', async () => {
    await expect(serverEventNames('http://camphoric.test', 'secret', serverWith([], 200, { username: 'admin' })))
      .rejects.toThrow('didn\'t say whether the token\'s user has terms to agree to');
  });

  test('says when the server refuses the token', async () => {
    const refusing = (async () => Response.json({ detail: 'Invalid token.' }, { status: 401 })) as typeof fetch;
    await expect(serverEventNames('http://camphoric.test', 'secret', refusing))
      .rejects.toThrow('It\'s invalid, expired or revoked');
  });
});

describe('waitForServer', () => {
  // Answers with each of `steps` in turn: an Error is a refused connection
  const startingServer = (steps: (number | Error)[]) => {
    let calls = 0;
    const fetchImpl = (async () => {
      const step = steps[Math.min(calls++, steps.length - 1)];
      if (step instanceof Error) throw step;
      return new Response('', { status: step });
    }) as typeof fetch;
    return { fetchImpl, calls: () => calls };
  };

  test('waits while there is no connection or a 5xx, until it answers', async () => {
    const server = startingServer([new TypeError('fetch failed'), 502, 403]);
    await waitForServer('http://camphoric.test', { intervalMs: 1, fetchImpl: server.fetchImpl, log: () => {} });
    expect(server.calls()).toBe(3);
  });

  test('says why when the connection is refused with no message', async () => {
    const refused = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new AggregateError([], ''), { code: 'ECONNREFUSED' }),
    });
    const server = startingServer([refused]);
    await expect(waitForServer('http://camphoric.test', {
      timeoutMs: 10, intervalMs: 5, fetchImpl: server.fetchImpl, log: () => {},
    })).rejects.toThrow('didn\'t start in time: ECONNREFUSED');
  });

  test('gives up after its timeout, saying why', async () => {
    const server = startingServer([503]);
    await expect(waitForServer('http://camphoric.test', {
      timeoutMs: 20, intervalMs: 5, fetchImpl: server.fetchImpl, log: () => {},
    })).rejects.toThrow('didn\'t start in time: it answers 503');
  });
});

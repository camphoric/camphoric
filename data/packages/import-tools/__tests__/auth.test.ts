/**
 * The API token (from CAMPHORIC_API_TOKEN or CAMPHORIC_API_TOKEN_FILE), the
 * header it's sent in, what the tools say when the server refuses it, revoking
 * it, and the check that keeps the tools to a local server unless
 * CAMPHORIC_ALLOW_REMOTE=1.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, test } from '@jest/globals';

import CamphoricFetcher from '../CamphoricFetcher.ts';
import {
  ApiTokenError, assertLocalServer, authorization, getAuthToken, isLocalServer, readApiToken, revokeAuthToken,
  tokenRefusal,
} from '../getAuthInfo.ts';

const realEnv = { ...process.env };

describe('isLocalServer', () => {
  test.each([
    'http://localhost:8000',
    'http://LOCALHOST:8000/',
    'http://127.0.0.1:8000',
    'http://[::1]:8000',
    'http://django:8000',
    'http://camphoric.localhost',
    'https://camphoric.test/',
  ])('%s is local', (url) => {
    expect(isLocalServer(url)).toBe(true);
  });

  test.each([
    'https://harmonyreg.sffmc.org',
    'https://registration.larkcamp.org/',
    'http://192.168.33.10:8000',
    'http://localhost.example.com',
    'http://django.example.com',
    'http://test',
  ])('%s is not', (url) => {
    expect(isLocalServer(url)).toBe(false);
  });

  test('rejects something that isn\'t a URL', () => {
    expect(() => isLocalServer('not a url')).toThrow('isn\'t a server URL');
  });
});

describe('assertLocalServer', () => {
  test('refuses a remote server, saying how to allow it', () => {
    expect(() => assertLocalServer('https://registration.larkcamp.org', {}))
      .toThrow(/refusing to use https:\/\/registration\.larkcamp\.org.*CAMPHORIC_ALLOW_REMOTE=1/);
  });

  test('allows a remote server with CAMPHORIC_ALLOW_REMOTE=1', () => {
    expect(() => assertLocalServer('https://registration.larkcamp.org', { CAMPHORIC_ALLOW_REMOTE: '1' }))
      .not.toThrow();
  });

  test('takes only 1 as allowing it', () => {
    expect(() => assertLocalServer('https://registration.larkcamp.org', { CAMPHORIC_ALLOW_REMOTE: '0' }))
      .toThrow('refusing to use');
  });

  test('allows a local server', () => {
    expect(() => assertLocalServer('http://localhost:8000', {})).not.toThrow();
  });
});

const TOKEN = 'cmph_Q2xhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0';

const tokenDirectories: string[] = [];
afterAll(() => {
  tokenDirectories.forEach(directory => fs.rmSync(directory, { recursive: true, force: true }));
});

// A file holding `contents`, in a directory of its own
function tokenFile(contents: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'camphoric-token-'));
  tokenDirectories.push(directory);
  const file = path.join(directory, 'token');
  fs.writeFileSync(file, contents);
  return file;
}

describe('readApiToken', () => {
  test('reads CAMPHORIC_API_TOKEN', async () => {
    await expect(readApiToken({ CAMPHORIC_API_TOKEN: TOKEN })).resolves.toBe(TOKEN);
  });

  test('reads the file CAMPHORIC_API_TOKEN_FILE names, without its newline', async () => {
    await expect(readApiToken({ CAMPHORIC_API_TOKEN_FILE: tokenFile(`${TOKEN}\n`) })).resolves.toBe(TOKEN);
  });

  test('takes CAMPHORIC_API_TOKEN over the file', async () => {
    const other = `${TOKEN}-other`;
    await expect(readApiToken({ CAMPHORIC_API_TOKEN: other, CAMPHORIC_API_TOKEN_FILE: tokenFile(TOKEN) }))
      .resolves.toBe(other);
  });

  test('without either, says how to mint one', async () => {
    const reading = readApiToken({});
    await expect(reading).rejects.toThrow(ApiTokenError);
    await expect(reading).rejects.toThrow(/no API token: set CAMPHORIC_API_TOKEN/);
    await expect(reading).rejects.toThrow('./manage.py camphoric_api_token create <you>');
    await expect(reading).rejects.toThrow('docker compose exec -T django ./manage.py camphoric_api_token create');
    await expect(reading).rejects.toThrow('pipenv run python manage.py camphoric_api_token create');
  });

  test('says the superuser\'s password is no longer used, when it\'s set', async () => {
    await expect(readApiToken({ DJANGO_SUPERUSER_USERNAME: 'admin', DJANGO_SUPERUSER_PASSWORD: 'admin' }))
      .rejects.toThrow('no longer sign in with DJANGO_SUPERUSER_USERNAME / _PASSWORD');
  });

  test('says when the file is missing or empty', async () => {
    const missing = path.join(os.tmpdir(), 'camphoric-no-such-token');
    await expect(readApiToken({ CAMPHORIC_API_TOKEN_FILE: missing }))
      .rejects.toThrow(`couldn't read CAMPHORIC_API_TOKEN_FILE (${missing})`);
    await expect(readApiToken({ CAMPHORIC_API_TOKEN_FILE: tokenFile('\n') })).rejects.toThrow('is empty');
  });

  // (An old per-user token would reach the server's OAuth authentication)
  test('refuses what isn\'t a personal access token, without showing it', async () => {
    const reading = readApiToken({ CAMPHORIC_API_TOKEN: '9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b' });
    await expect(reading).rejects.toThrow('CAMPHORIC_API_TOKEN isn\'t a personal access token (they start with cmph_)');
    await expect(reading).rejects.not.toThrow('9944b');
  });
});

describe('authorization', () => {
  test('sends the token as a bearer token', () => {
    expect(authorization(TOKEN)).toEqual({ Authorization: `Bearer ${TOKEN}` });
  });
});

describe('getAuthToken', () => {
  afterEach(() => {
    process.env = { ...realEnv };
  });

  function withToken() {
    process.env.CAMPHORIC_API_TOKEN = TOKEN;
    delete process.env.CAMPHORIC_API_TOKEN_FILE;
    delete process.env.CAMPHORIC_ALLOW_REMOTE;
  }

  test('gives the token for a local server', async () => {
    withToken();
    await expect(getAuthToken('http://localhost:8000')).resolves.toBe(TOKEN);
  });

  test('refuses a remote server before reading the token', async () => {
    delete process.env.CAMPHORIC_API_TOKEN;
    delete process.env.CAMPHORIC_API_TOKEN_FILE;
    delete process.env.CAMPHORIC_ALLOW_REMOTE;
    // (No token is set, so a check after reading it would fail differently)
    await expect(getAuthToken('https://registration.larkcamp.org')).rejects.toThrow('CAMPHORIC_ALLOW_REMOTE=1');
  });

  test('gives it for a remote server with CAMPHORIC_ALLOW_REMOTE=1', async () => {
    withToken();
    process.env.CAMPHORIC_ALLOW_REMOTE = '1';
    await expect(getAuthToken('https://registration.larkcamp.org')).resolves.toBe(TOKEN);
  });
});

describe('tokenRefusal', () => {
  test('says a 401\'s token is invalid, expired or revoked, and how to mint one', () => {
    const refusal = tokenRefusal(401, JSON.stringify({ detail: 'Invalid token.' }));
    expect(refusal).toBeInstanceOf(ApiTokenError);
    expect(refusal?.message).toMatch(/^the server refused the API token \(401: Invalid token\.\)\. It's invalid, expired or revoked/);
    expect(refusal?.message).toContain('camphoric_api_token create');
  });

  test('shows the terms the token\'s user has to agree to, and where', () => {
    const detail = 'Lark Camp has new terms to agree to. Sign in to Camphoric to agree to them, then try again.';
    const refusal = tokenRefusal(403, JSON.stringify({
      detail, code: 'contract_agreement_required', organization: 3, organization_name: 'Lark Camp',
      contract_url: 'https://registration.example.org/admin/',
    }));
    expect(refusal?.message).toBe([
      detail,
      'Organization: Lark Camp',
      'Agree to its terms at https://registration.example.org/admin/ (signed in as the token\'s user), then run this again.',
    ].join('\n'));
  });

  test('says to sign in to the admin when the server has no public URL', () => {
    const refusal = tokenRefusal(403, JSON.stringify({
      detail: 'Terms.', code: 'contract_agreement_required', organization: 3, organization_name: 'Lark Camp',
      contract_url: null,
    }));
    expect(refusal?.message).toContain('Sign in to Camphoric\'s admin as the token\'s user to agree to its terms');
  });

  test('says a read-only token can\'t change data', () => {
    expect(tokenRefusal(403, JSON.stringify({ detail: 'Read-only.', code: 'read_only_token' }))?.message)
      .toContain('mint one without --read-only');
  });

  test.each([
    [403, { detail: 'You do not have permission to perform this action.' }],
    [400, { name: ['This field is required.'] }],
    [404, 'not JSON'],
    [200, []],
  ])('leaves any other %s alone', (status, body) => {
    expect(tokenRefusal(status, typeof body === 'string' ? body : JSON.stringify(body))).toBeUndefined();
  });

  test('is what the fetcher rejects with', async () => {
    const realFetch = globalThis.fetch;
    const sent: Headers[] = [];
    globalThis.fetch = async (_input, init) => {
      sent.push(new Headers(init?.headers));
      return Response.json({ detail: 'Token expired.' }, { status: 401 });
    };
    try {
      const fetcher = new CamphoricFetcher('http://camphoric.test', TOKEN);
      await expect(fetcher.fetch('GET', '/api/events/')).rejects.toThrow('(401: Token expired.). It\'s invalid, expired or revoked');
      expect(sent.map(headers => headers.get('Authorization'))).toEqual([`Bearer ${TOKEN}`]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test('a token given to the fetcher isn\'t sent to a remote server', async () => {
    const realFetch = globalThis.fetch;
    let sent = 0;
    globalThis.fetch = async () => {
      sent += 1;
      return Response.json([]);
    };
    try {
      const fetcher = new CamphoricFetcher('https://registration.example.org', TOKEN);
      await expect(fetcher.fetch('GET', '/api/events/')).rejects.toThrow('CAMPHORIC_ALLOW_REMOTE=1');
      expect(sent).toBe(0);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe('revokeAuthToken', () => {
  // A stand-in server answering `status`; `sent` is what it got
  function serverAnswering(status: number, body?: unknown) {
    const sent: { url: string, method?: string, authorization: string | null }[] = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      sent.push({ url: String(input), method: init?.method, authorization: new Headers(init?.headers).get('Authorization') });
      return body === undefined ? new Response(null, { status }) : Response.json(body, { status });
    }) as typeof fetch;
    return { fetchImpl, sent };
  }

  test('revokes the token it\'s sent with', async () => {
    const server = serverAnswering(204);
    await expect(revokeAuthToken('http://camphoric.test', TOKEN, server.fetchImpl)).resolves.toBe('revoked');
    expect(server.sent).toEqual([
      { url: 'http://camphoric.test/api/user/tokens/current', method: 'DELETE', authorization: `Bearer ${TOKEN}` },
    ]);
  });

  test('takes a token the server already refuses as ended', async () => {
    const server = serverAnswering(401, { detail: 'Token expired.' });
    await expect(revokeAuthToken('http://camphoric.test', TOKEN, server.fetchImpl)).resolves.toBe('already ended');
  });

  test('fails otherwise, saying how to revoke it by hand (by its prefix alone)', async () => {
    const server = serverAnswering(500, { detail: 'oops' });
    const revoking = revokeAuthToken('http://camphoric.test', TOKEN, server.fetchImpl);
    await expect(revoking).rejects.toThrow('couldn\'t revoke the API token (500: {"detail":"oops"}): revoke it on the '
      + 'server with `camphoric_api_token revoke cmph_Q2xhYmNk`');
    await expect(revoking).rejects.not.toThrow(TOKEN);
  });

  test('fails when it can\'t reach the server', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED 127.0.0.1:8000') });
    }) as typeof fetch;
    await expect(revokeAuthToken('http://localhost:8000', TOKEN, fetchImpl))
      .rejects.toThrow('couldn\'t revoke the API token (connect ECONNREFUSED 127.0.0.1:8000)');
  });

  test('never sends it to a remote server', async () => {
    const server = serverAnswering(204);
    delete process.env.CAMPHORIC_ALLOW_REMOTE;
    await expect(revokeAuthToken('https://registration.example.org', TOKEN, server.fetchImpl))
      .rejects.toThrow('refusing to use');
    expect(server.sent).toEqual([]);
  });
});

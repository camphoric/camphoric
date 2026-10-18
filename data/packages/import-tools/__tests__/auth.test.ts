/**
 * Logging in (once per server, since Camphoric throttles sign-in), and the
 * check that keeps the tools to a local server unless CAMPHORIC_ALLOW_REMOTE=1.
 *
 * getAuthToken keeps its tokens for the whole process, so each test that logs
 * in uses a server no other test does.
 */

import { afterEach, describe, expect, test } from '@jest/globals';

import { assertLocalServer, getAuthToken, isLocalServer } from '../getAuthInfo.ts';

const realFetch = globalThis.fetch;
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

describe('getAuthToken', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
    process.env = { ...realEnv };
  });

  // Logs in as admin to a stand-in server; returns the URLs it's sent
  function stubLogin(): string[] {
    const sent: string[] = [];
    globalThis.fetch = async (input) => {
      sent.push(String(input));
      return Response.json({ token: 'token' });
    };
    process.env.DJANGO_SUPERUSER_USERNAME = 'admin';
    process.env.DJANGO_SUPERUSER_PASSWORD = 'admin';
    delete process.env.CAMPHORIC_ALLOW_REMOTE;
    return sent;
  }

  test('refuses a remote server before sending it anything', async () => {
    const sent = stubLogin();
    await expect(getAuthToken('https://registration.larkcamp.org')).rejects.toThrow('CAMPHORIC_ALLOW_REMOTE=1');
    expect(sent).toEqual([]);
  });

  test('logs in to a remote server with CAMPHORIC_ALLOW_REMOTE=1', async () => {
    const sent = stubLogin();
    process.env.CAMPHORIC_ALLOW_REMOTE = '1';
    await expect(getAuthToken('https://registration.larkcamp.org')).resolves.toBe('token');
    expect(sent).toEqual(['https://registration.larkcamp.org/api-token-auth/']);
  });

  test('logs in to a local server', async () => {
    const sent = stubLogin();
    await expect(getAuthToken('http://localhost:8000')).resolves.toBe('token');
    expect(sent).toEqual(['http://localhost:8000/api-token-auth/']);
  });

  test('signs in once per server', async () => {
    stubLogin();
    const sent: string[] = [];
    globalThis.fetch = async (input) => {
      sent.push(String(input));
      return Response.json({ token: `token${sent.length}` });
    };
    const tokens = await Promise.all([
      getAuthToken('http://one.test'),
      getAuthToken('http://one.test'),
      getAuthToken('http://two.test'),
    ]);
    expect(await getAuthToken('http://one.test')).toBe('token1');
    expect(tokens).toEqual(['token1', 'token1', 'token2']);
    expect(sent).toEqual(['http://one.test/api-token-auth/', 'http://two.test/api-token-auth/']);
  });

  test('tries again after a failed sign-in', async () => {
    stubLogin();
    globalThis.fetch = async () => Response.json({ detail: 'throttled' }, { status: 429 });
    await expect(getAuthToken('http://three.test')).rejects.toThrow('throttled');
    globalThis.fetch = async () => Response.json({ token: 'fresh' });
    await expect(getAuthToken('http://three.test')).resolves.toBe('fresh');
  });

  test('refuses a remote server even with a token kept from an earlier call', async () => {
    const sent = stubLogin();
    process.env.CAMPHORIC_ALLOW_REMOTE = '1';
    await expect(getAuthToken('https://camp.example.org')).resolves.toBe('token');
    delete process.env.CAMPHORIC_ALLOW_REMOTE;
    await expect(getAuthToken('https://camp.example.org')).rejects.toThrow('CAMPHORIC_ALLOW_REMOTE=1');
    expect(sent).toEqual(['https://camp.example.org/api-token-auth/']);
  });
});

/**
 * camphoricServer() with an existing server (CAMPHORIC_E2E_SERVER_URL): it
 * takes an admin's API token, CAMPHORIC_E2E_SERVER_TOKEN, and starts nothing.
 * (A throwaway server needs Docker, so CI's e2e job runs that.)
 */

import { afterEach, describe, expect, test } from '@jest/globals';

import { camphoricServer } from '../e2eServer.ts';

const realEnv = { ...process.env };

describe('camphoricServer, with CAMPHORIC_E2E_SERVER_URL', () => {
  afterEach(() => {
    process.env = { ...realEnv };
  });

  test('uses the server, with CAMPHORIC_E2E_SERVER_TOKEN', async () => {
    process.env.CAMPHORIC_E2E_SERVER_URL = 'http://camphoric.test/';
    process.env.CAMPHORIC_E2E_SERVER_TOKEN = 'cmph_token';
    await expect(camphoricServer()).resolves.toMatchObject({ url: 'http://camphoric.test', token: 'cmph_token' });
  });

  test('without a token, says how to mint one', async () => {
    process.env.CAMPHORIC_E2E_SERVER_URL = 'http://camphoric.test';
    delete process.env.CAMPHORIC_E2E_SERVER_TOKEN;
    delete process.env.CAMPHORIC_E2E_SERVER_USERNAME;
    delete process.env.CAMPHORIC_E2E_SERVER_PASSWORD;
    const starting = camphoricServer();
    await expect(starting).rejects.toThrow('CAMPHORIC_E2E_SERVER_URL needs CAMPHORIC_E2E_SERVER_TOKEN');
    await expect(starting).rejects.toThrow('camphoric_api_token create <you>');
  });

  test('with a username and password but no token, says they only sign in to the admin client', async () => {
    process.env.CAMPHORIC_E2E_SERVER_URL = 'http://camphoric.test';
    delete process.env.CAMPHORIC_E2E_SERVER_TOKEN;
    process.env.CAMPHORIC_E2E_SERVER_USERNAME = 'admin';
    process.env.CAMPHORIC_E2E_SERVER_PASSWORD = 'admin';
    await expect(camphoricServer()).rejects.toThrow(
      'CAMPHORIC_E2E_SERVER_USERNAME / _PASSWORD only sign in to the admin client in a browser');
  });

  test('passes on the admin\'s username and password, for signing in to the admin client', async () => {
    process.env.CAMPHORIC_E2E_SERVER_URL = 'http://camphoric.test';
    process.env.CAMPHORIC_E2E_SERVER_TOKEN = 'cmph_token';
    process.env.CAMPHORIC_E2E_SERVER_USERNAME = 'admin';
    process.env.CAMPHORIC_E2E_SERVER_PASSWORD = 'secret';
    await expect(camphoricServer()).resolves.toMatchObject({ admin: { username: 'admin', password: 'secret' } });
  });

  test('has no admin credentials without both', async () => {
    process.env.CAMPHORIC_E2E_SERVER_URL = 'http://camphoric.test';
    process.env.CAMPHORIC_E2E_SERVER_TOKEN = 'cmph_token';
    process.env.CAMPHORIC_E2E_SERVER_USERNAME = 'admin';
    delete process.env.CAMPHORIC_E2E_SERVER_PASSWORD;
    expect((await camphoricServer()).admin).toBeUndefined();
  });
});

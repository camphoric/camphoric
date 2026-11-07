/**
 * The importer end to end, against a stand-in Camphoric API: it sends its
 * API token as a bearer token; with --if-empty it imports into a server with
 * no events, and leaves a server with events alone; and with --revoke-token
 * it revokes its token when the run ends, however it ends.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';

import { eventName } from '../../events/sample-camp/index.ts';

const DATA = fileURLToPath(new URL('../..', import.meta.url));

// The token the stand-in server takes (anything else gets a 401)
const TOKEN = 'cmph_dGVzdHRva2VudGVzdHRva2VudGVzdHRva2VudGVzdA';
const REVOKE = '/api/user/tokens/current';

// The events the stand-in server says it has, and every request it got
let serverEvents: { id: number, name: string }[] = [];
let requests: { method: string, url: string, authorization?: string }[] = [];
let nextId = 1;
// Whether it refuses registrations, as a server does outside an event's window
let registrationClosed = false;
// The organizations whose terms the token's user has yet to agree to
let pendingTerms: number[] = [];

const server = http.createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const url = req.url ?? '';
  requests.push({ method: req.method ?? '', url, authorization: req.headers.authorization });
  const send = (status: number, data?: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(data === undefined ? '' : JSON.stringify(data));
  };
  // (The public registration form takes no token)
  if (req.headers.authorization !== `Bearer ${TOKEN}` && !(req.method === 'GET' && url.endsWith('/register'))) {
    return send(401, { detail: 'Invalid token.' });
  }
  if (req.method === 'GET' && url === '/api/user') {
    return send(200, { username: 'admin', pending_contract_organizations: pendingTerms });
  }
  if (req.method === 'GET' && url === '/api/events/') return send(200, serverEvents);
  if (req.method === 'GET') return send(200, []);
  if (req.method === 'DELETE') return send(204);
  if (registrationClosed && /^\/api\/events\/\d+\/register$/.test(url)) {
    return send(409, { detail: 'Registration for this event is closed.' });
  }
  return send(req.method === 'POST' ? 201 : 200,
    { ...JSON.parse(body || '{}'), id: nextId++, confirmation_template: 9000, invitation_template: 9001 });
});

let url = '';

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

// Runs the importer for Sample Camp alone. (Asynchronously: the stand-in
// server answers it from this process.)
function importSampleCamp(...args: string[]): Promise<{ status: number, stdout: string, stderr: string }> {
  return runImporter(args);
}

function runImporter(
  args: string[],
  { sampleRegistrations = false, serverUrl = url, token = { CAMPHORIC_API_TOKEN: TOKEN } as Record<string, string> } = {},
): Promise<{ status: number, stdout: string, stderr: string }> {
  requests = [];
  return new Promise(resolve => execFile('node_modules/.bin/tsx', ['--conditions=camphoric-source', 'loadAllData.ts', ...args], {
    cwd: DATA,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      CAMPHORIC_URL: serverUrl,
      CAMPHORIC_ALLOW_REMOTE: '',
      CAMPHORIC_EVENTS: 'sample-camp',
      CAMPHORIC_API_TOKEN: '',
      CAMPHORIC_API_TOKEN_FILE: '',
      ...token,
      SKIP_TEST_REGS: sampleRegistrations ? '0' : '1',
    },
  }, (error, stdout, stderr) => resolve({ status: error ? Number(error.code ?? 1) : 0, stdout, stderr })));
}

const posts = (path: string) => requests.filter(r => r.method === 'POST' && r.url === path);
const revocations = () => requests.filter(r => r.method === 'DELETE' && r.url === REVOKE);

describe('the importer, with --if-empty', () => {
  test('imports into a server with no events', async () => {
    serverEvents = [];
    const run = await importSampleCamp('--if-empty');
    // (Its progress goes to stderr, so show that only when the run fails)
    expect({ status: run.status, stderr: run.status ? run.stderr.slice(-500) : '' }).toEqual({ status: 0, stderr: '' });
    expect(posts('/api/events/')).toHaveLength(1);
    // Every request but the public form's sends the token as a bearer token
    expect(requests.filter(r => r.authorization !== `Bearer ${TOKEN}`).map(r => r.url))
      .toEqual(requests.filter(r => r.url.endsWith('/register') && r.method === 'GET').map(r => r.url));
    // (Not without --revoke-token: a token its user keeps stays)
    expect(revocations()).toEqual([]);
  }, 60_000);

  test('leaves a server with any event alone, sending it nothing', async () => {
    serverEvents = [{ id: 1, name: 'Some Other Camp' }];
    const run = await importSampleCamp('--if-empty');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('already has events, so nothing is imported');
    expect(requests.filter(r => r.method !== 'GET')).toEqual([]);
  }, 60_000);

  // The server leaves those organizations' events out of its events list
  test('fails, importing nothing, when the token\'s user has terms to agree to', async () => {
    serverEvents = [];
    pendingTerms = [3];
    try {
      const run = await importSampleCamp('--if-empty');
      expect(run.status).toBe(1);
      expect(run.stderr).toContain('admin has yet to agree to the terms of organization 3 (by id)');
      // (Flushing the database isn't the answer)
      expect(run.stderr).not.toContain('reset-data-and-test');
      expect(requests.filter(r => r.method !== 'GET')).toEqual([]);
    } finally {
      pendingTerms = [];
    }
  }, 60_000);

  test('without it, imports the event regardless', async () => {
    serverEvents = [{ id: 1, name: eventName }];
    const run = await importSampleCamp();
    expect(run.status).toBe(0);
    expect(requests.some(r => r.method === 'PUT' && r.url === '/api/events/1/')).toBe(true);
  }, 60_000);
});

// The creator starts requests ahead of collecting them, pausing between
// batches; a rejection during a pause must reach the importer's own error
// handling (which, with --if-empty, says how to retry), not end the process
// as an unhandled rejection.
test('a rejected sample registration fails the import through its error handling', async () => {
  serverEvents = [];
  registrationClosed = true;
  try {
    const run = await runImporter(['--if-empty'], { sampleRegistrations: true });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('test registration rejected (409)');
    expect(run.stderr).toContain('start again with ./data/reset-data-and-test');
  } finally {
    registrationClosed = false;
  }
}, 60_000);

describe('the importer\'s token', () => {
  test('is read from the file CAMPHORIC_API_TOKEN_FILE names', async () => {
    serverEvents = [{ id: 1, name: 'Some Other Camp' }];
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'camphoric-import-token-'));
    try {
      const file = path.join(directory, 'token');
      fs.writeFileSync(file, `${TOKEN}\n`);
      const run = await runImporter(['--if-empty'], { token: { CAMPHORIC_API_TOKEN_FILE: file } });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('already has events');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }, 60_000);

  test('missing, fails before sending anything, saying how to mint one', async () => {
    const run = await runImporter([], { token: {} });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('no API token: set CAMPHORIC_API_TOKEN');
    expect(run.stderr).toContain('camphoric_api_token create <you>');
    expect(requests).toEqual([]);
  }, 60_000);

  test('refused by the server, says it\'s invalid, expired or revoked', async () => {
    serverEvents = [];
    const run = await runImporter([], { token: { CAMPHORIC_API_TOKEN: 'cmph_revoked' } });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('the server refused the API token (401: Invalid token.). It\'s invalid, expired or revoked');
  }, 60_000);
});

describe('the importer, with --revoke-token', () => {
  test('revokes its token once it has imported', async () => {
    serverEvents = [];
    const run = await importSampleCamp('--revoke-token');
    expect({ status: run.status, stderr: run.status ? run.stderr.slice(-500) : '' }).toEqual({ status: 0, stderr: '' });
    expect(revocations()).toEqual([{ method: 'DELETE', url: REVOKE, authorization: `Bearer ${TOKEN}` }]);
    // (Its last request)
    expect(requests.at(-1)?.url).toBe(REVOKE);
    expect(run.stdout).toContain('Revoked the API token');
  }, 60_000);

  test('revokes it when --if-empty leaves the server alone', async () => {
    serverEvents = [{ id: 1, name: 'Some Other Camp' }];
    const run = await importSampleCamp('--if-empty', '--revoke-token');
    expect(run.status).toBe(0);
    expect(revocations()).toHaveLength(1);
  }, 60_000);

  test('revokes it when the import fails, and still fails', async () => {
    serverEvents = [];
    registrationClosed = true;
    try {
      const run = await runImporter(['--revoke-token'], { sampleRegistrations: true });
      expect(run.status).toBe(1);
      expect(run.stderr).toContain('test registration rejected (409)');
      expect(revocations()).toHaveLength(1);
    } finally {
      registrationClosed = false;
    }
  }, 60_000);
});

// A stray CAMPHORIC_URL (say, in data/.env) mustn't aim the importer at a live
// server: it fails at once, without waiting for that server (--wait) or
// logging in to it.
test('refuses a server that isn\'t local', async () => {
  const run = await runImporter(['--wait'], { serverUrl: 'https://registration.example.org' });
  expect(run.status).toBe(1);
  expect(run.stderr).toContain('refusing to use https://registration.example.org');
  expect(run.stderr).toContain('CAMPHORIC_ALLOW_REMOTE=1');
  expect(run.stdout).not.toContain('waiting for');
}, 60_000);

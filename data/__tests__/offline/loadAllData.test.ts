/**
 * The importer end to end, against a stand-in Camphoric API: with --if-empty
 * it imports into a server with no events, and leaves a server with events
 * alone.
 */

import { execFile } from 'node:child_process';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';

import { eventName } from '../../events/sample-camp/index.ts';

const DATA = fileURLToPath(new URL('../..', import.meta.url));

// The events the stand-in server says it has, and every request it got
let serverEvents: { id: number, name: string }[] = [];
let requests: { method: string, url: string }[] = [];
let nextId = 1;
// Whether it refuses registrations, as a server does outside an event's window
let registrationClosed = false;

const server = http.createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const url = req.url ?? '';
  requests.push({ method: req.method ?? '', url });
  const send = (status: number, data?: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(data === undefined ? '' : JSON.stringify(data));
  };
  if (url.startsWith('/api-token-auth')) return send(200, { token: 'test-token' });
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
  { sampleRegistrations = false, serverUrl = url } = {},
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
      DJANGO_SUPERUSER_USERNAME: 'admin',
      DJANGO_SUPERUSER_PASSWORD: 'admin',
      SKIP_TEST_REGS: sampleRegistrations ? '0' : '1',
    },
  }, (error, stdout, stderr) => resolve({ status: error ? Number(error.code ?? 1) : 0, stdout, stderr })));
}

const posts = (path: string) => requests.filter(r => r.method === 'POST' && r.url === path);

describe('the importer, with --if-empty', () => {
  test('imports into a server with no events', async () => {
    serverEvents = [];
    const run = await importSampleCamp('--if-empty');
    // (Its progress goes to stderr, so show that only when the run fails)
    expect({ status: run.status, stderr: run.status ? run.stderr.slice(-500) : '' }).toEqual({ status: 0, stderr: '' });
    expect(posts('/api/events/')).toHaveLength(1);
  }, 60_000);

  test('leaves a server with any event alone, sending it nothing', async () => {
    serverEvents = [{ id: 1, name: 'Some Other Camp' }];
    const run = await importSampleCamp('--if-empty');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('already has events, so nothing is imported');
    expect(requests.filter(r => r.method !== 'GET' && !r.url.startsWith('/api-token-auth'))).toEqual([]);
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

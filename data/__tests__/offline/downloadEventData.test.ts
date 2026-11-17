/**
 * download-event-data.ts saves an event's data export (camphoric/camphoric#1016)
 * as a JSON file: its token from the environment or a hidden prompt, its file
 * named by the server but kept to one directory, and never a partial file.
 */

import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';

import {
  PromptCancelled, downloadEventData, downloadOptions, fallbackFileName, fileNameFrom, formatSize,
  getToken, promptHidden, removePartialDownloads, serverUrl, type PromptInput,
} from '../../downloadEventData.ts';

const TOKEN = `cmph_${'a'.repeat(43)}`;
const SERVER = 'https://camp.example.org';

describe('downloadOptions', () => {
  test('takes an event ID, an output file and --force', () => {
    expect(downloadOptions(['12'])).toEqual({ eventId: '12', force: false, help: false });
    expect(downloadOptions(['12', '-o', 'out.json', '--force']))
      .toEqual({ eventId: '12', output: 'out.json', force: true, help: false });
    expect(downloadOptions(['--output=out.json', '12']).output).toBe('out.json');
  });

  test('--help needs nothing else', () => {
    expect(downloadOptions(['--help']).help).toBe(true);
    expect(downloadOptions(['-h']).help).toBe(true);
  });

  test.each([
    [[], 'give one event ID'],
    [['12', '13'], 'give one event ID'],
    [['0'], 'give one event ID'],
    [['twelve'], 'give one event ID'],
    [['12', '--yes'], 'unknown option --yes'],
    [['12', '--output'], '--output needs a file name'],
    [['12', '-o', '--force'], '-o needs a file name'],
  ])('refuses %j', (args, message) => {
    expect(() => downloadOptions(args)).toThrow(message);
  });
});

describe('serverUrl', () => {
  test('is CAMPHORIC_URL, without a trailing slash', () => {
    expect(serverUrl({ CAMPHORIC_URL: 'https://camp.example.org/' })).toBe(SERVER);
    expect(serverUrl({ CAMPHORIC_URL: 'http://localhost:8000' })).toBe('http://localhost:8000');
  });

  test('is required', () => {
    expect(() => serverUrl({})).toThrow('set CAMPHORIC_URL');
  });

  test('never sends the token over plain http to a server that isn\'t local', () => {
    expect(() => serverUrl({ CAMPHORIC_URL: 'http://camp.example.org' })).toThrow('use its https:// address');
  });

  test('refuses what isn\'t an http(s) URL', () => {
    expect(() => serverUrl({ CAMPHORIC_URL: 'camp.example.org' })).toThrow('isn\'t a server URL');
    expect(() => serverUrl({ CAMPHORIC_URL: 'ftp://camp.example.org' })).toThrow('isn\'t an http(s) URL');
  });
});

// A terminal that types `keys` once the prompt starts listening
class FakeTerminal extends EventEmitter implements PromptInput {
  isTTY = true;
  isRaw = false;
  rawModes: boolean[] = [];
  keys: string[];
  constructor(keys: string[] = []) {
    super();
    this.keys = keys;
  }
  setRawMode(mode: boolean) {
    this.isRaw = mode;
    this.rawModes.push(mode);
  }
  resume() {
    for (const key of this.keys) setImmediate(() => this.emit('data', Buffer.from(key)));
  }
  pause() {}
}

function terminalOutput() {
  const written: string[] = [];
  return { written, write: (text: string) => written.push(text) };
}

describe('promptHidden', () => {
  test('reads up to Enter without echoing it, in raw mode, then restores the terminal', async () => {
    const input = new FakeTerminal(['cmph_', 'abc\r']);
    const output = terminalOutput();
    await expect(promptHidden('Token: ', input, output)).resolves.toBe('cmph_abc');
    expect(output.written).toEqual(['Token: ', '\n']);
    expect(input.rawModes).toEqual([true, false]);
    expect(input.listenerCount('data')).toBe(0);
  });

  test('Backspace deletes, and control characters are dropped', async () => {
    const input = new FakeTerminal(['abx\u007fc\u001b\n']);
    await expect(promptHidden('Token: ', input, terminalOutput())).resolves.toBe('abc');
  });

  test('arrow keys and other escape sequences type nothing, even split across reads', async () => {
    const input = new FakeTerminal(['ab\u001b[D', 'c\u001bOA', 'd\u001b', '[1;5C', 'e\r']);
    await expect(promptHidden('Token: ', input, terminalOutput())).resolves.toBe('abcde');
  });

  test('a bracketed paste is the text pasted', async () => {
    const input = new FakeTerminal([`\u001b[200~${TOKEN}\u001b[201~\r`]);
    await expect(promptHidden('Token: ', input, terminalOutput())).resolves.toBe(TOKEN);
  });

  test('Ctrl-C cancels', async () => {
    const input = new FakeTerminal(['ab\u0003']);
    await expect(promptHidden('Token: ', input, terminalOutput())).rejects.toBeInstanceOf(PromptCancelled);
    expect(input.isRaw).toBe(false);
  });

  test('Ctrl-D on nothing ends it empty', async () => {
    await expect(promptHidden('Token: ', new FakeTerminal(['\u0004']), terminalOutput())).resolves.toBe('');
  });
});

describe('getToken', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'download-event-data-'));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  test('takes CAMPHORIC_API_TOKEN without asking', async () => {
    const input = new FakeTerminal();
    await expect(getToken({ env: { CAMPHORIC_API_TOKEN: TOKEN }, input, url: SERVER })).resolves.toBe(TOKEN);
    expect(input.rawModes).toEqual([]);
  });

  test('or the file CAMPHORIC_API_TOKEN_FILE names', async () => {
    const file = path.join(dir, 'token');
    await fs.writeFile(file, `${TOKEN}\n`);
    await expect(getToken({ env: { CAMPHORIC_API_TOKEN_FILE: file }, input: new FakeTerminal(), url: SERVER }))
      .resolves.toBe(TOKEN);
  });

  test('a token in the environment must be a personal access token', async () => {
    await expect(getToken({ env: { CAMPHORIC_API_TOKEN: 'abc' }, url: SERVER }))
      .rejects.toThrow('isn\'t a personal access token');
  });

  test('with neither, asks for it on the terminal, naming the server', async () => {
    const output = terminalOutput();
    const input = new FakeTerminal([`  ${TOKEN}  \r`]);
    await expect(getToken({ env: {}, input, output, url: SERVER })).resolves.toBe(TOKEN);
    expect(output.written[0]).toBe(`Personal access token for ${SERVER}: `);
  });

  test('a typed token must be a personal access token, and not blank', async () => {
    await expect(getToken({ env: {}, input: new FakeTerminal(['abc\r']), output: terminalOutput(), url: SERVER }))
      .rejects.toThrow('isn\'t a personal access token');
    await expect(getToken({ env: {}, input: new FakeTerminal(['\r']), output: terminalOutput(), url: SERVER }))
      .rejects.toThrow('no API token given');
  });

  test('without a terminal to ask on, says how to give one', async () => {
    const input = Object.assign(new FakeTerminal(), { isTTY: false });
    await expect(getToken({ env: {}, input, url: SERVER })).rejects.toThrow('set CAMPHORIC_API_TOKEN');
  });
});

describe('fileNameFrom', () => {
  test.each([
    ['attachment; filename="Lark Camp 2027 data 2026-11-17.json"', 'Lark Camp 2027 data 2026-11-17.json'],
    ['attachment; filename=plain.json', 'plain.json'],
    // The RFC 5987 form wins, for names that aren't ASCII
    [
      'attachment; filename="Caf_ data.json"; filename*=UTF-8\'\'Caf%C3%A9%20data.json',
      'Café data.json',
    ],
    ['attachment; filename="say \\"hi\\".json"', 'say "hi".json'],
  ])('%s', (header, name) => {
    expect(fileNameFrom(header)).toBe(name);
  });

  test('never names a file outside the directory, or a hidden one', () => {
    expect(fileNameFrom('attachment; filename="../../.bashrc"')).toBe('_.._.bashrc');
    expect(fileNameFrom('attachment; filename="/etc/passwd"')).toBe('_etc_passwd');
    expect(fileNameFrom('attachment; filename="..\\\\x.json"')).toBe('_x.json');
    expect(fileNameFrom('attachment; filename=".."')).toBeUndefined();
  });

  test('none without a name', () => {
    expect(fileNameFrom(null)).toBeUndefined();
    expect(fileNameFrom('attachment')).toBeUndefined();
  });

  test('falls back to the event and the date', () => {
    expect(fallbackFileName('12', new Date('2026-11-17T20:00:00Z'))).toBe('event 12 data 2026-11-17.json');
  });
});

test('formatSize', () => {
  expect(formatSize(512)).toBe('512 B');
  expect(formatSize(3400)).toBe('3.4 kB');
  expect(formatSize(12_000_000)).toBe('12.0 MB');
  // Rounded before the unit is chosen
  expect(formatSize(999_950)).toBe('1.0 MB');
  expect(formatSize(999_949)).toBe('999.9 kB');
  expect(formatSize(999_960_000)).toBe('1.0 GB');
});

describe('downloadEventData', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'download-event-data-'));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const EXPORT = JSON.stringify({ meta: { event: { id: 12, name: 'Lark Camp' } }, campers: [] });
  const DISPOSITION = 'attachment; filename="Lark Camp data 2026-11-17.json"';

  // A stand-in for the server: answers every request with `response`, and keeps them
  function server(response: () => Response) {
    const requests: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      return response();
    }) as unknown as typeof fetch;
    return { requests, fetchImpl };
  }

  const exported = (headers: Record<string, string> = {}) => () => new Response(EXPORT, {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': DISPOSITION, ...headers },
  });

  const download = (fetchImpl: typeof fetch, options: { output?: string; force?: boolean } = {}) =>
    downloadEventData({ url: SERVER, token: TOKEN, eventId: '12', force: false, cwd: dir, fetchImpl, ...options });

  test('asks the export endpoint with the token, and saves the file the server names', async () => {
    const { requests, fetchImpl } = server(exported());
    const { file, bytes } = await download(fetchImpl);

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(`${SERVER}/api/events/12/export/`);
    expect(requests[0].init?.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
    expect(file).toBe(path.join(dir, 'Lark Camp data 2026-11-17.json'));
    expect(await fs.readFile(file, 'utf8')).toBe(EXPORT);
    expect(bytes).toBe(Buffer.byteLength(EXPORT));
    // Only its owner can read it, and nothing else is left in the directory
    expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
    expect(await fs.readdir(dir)).toEqual(['Lark Camp data 2026-11-17.json']);
  });

  test('without a name from the server, names it for the event and the date', async () => {
    const { fetchImpl } = server(exported({ 'Content-Disposition': 'attachment' }));
    const { file } = await downloadEventData({
      url: SERVER, token: TOKEN, eventId: '12', force: false, cwd: dir, fetchImpl,
      now: new Date('2026-11-17T20:00:00Z'),
    });
    expect(path.basename(file)).toBe('event 12 data 2026-11-17.json');
  });

  test('--output chooses the file', async () => {
    const { fetchImpl } = server(exported());
    const { file } = await download(fetchImpl, { output: 'camp.json' });
    expect(file).toBe(path.join(dir, 'camp.json'));
  });

  test('never replaces a file without --force', async () => {
    await fs.writeFile(path.join(dir, 'camp.json'), 'mine');
    const { requests, fetchImpl } = server(exported());
    await expect(download(fetchImpl, { output: 'camp.json' })).rejects.toThrow('already exists');
    // (Known before asking, so it isn't downloaded for nothing)
    expect(requests).toHaveLength(0);

    await fs.writeFile(path.join(dir, 'Lark Camp data 2026-11-17.json'), 'mine');
    await expect(download(fetchImpl)).rejects.toThrow('already exists');
    expect(await fs.readFile(path.join(dir, 'Lark Camp data 2026-11-17.json'), 'utf8')).toBe('mine');

    await download(fetchImpl, { output: 'camp.json', force: true });
    expect(await fs.readFile(path.join(dir, 'camp.json'), 'utf8')).toBe(EXPORT);
  });

  test.each([
    [401, { detail: 'Invalid token.' }, 'refused the API token'],
    [403, { detail: 'You do not have permission to perform this action.' }, 'only an Admin'],
    [404, { detail: 'Not found.' }, 'has no data export for event 12'],
    [500, { detail: 'Server Error' }, 'couldn\'t export event 12 (500: Server Error)'],
  ])('a %i says why, and saves nothing', async (status, body, message) => {
    const { fetchImpl } = server(() => new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    }));
    await expect(download(fetchImpl)).rejects.toThrow(message);
    expect(await fs.readdir(dir)).toEqual([]);
  });

  test('terms the token\'s user has to agree to come back as the server says them', async () => {
    const { fetchImpl } = server(() => new Response(JSON.stringify({
      detail: 'Agree to the terms first.', code: 'contract_agreement_required', organization_name: 'Lark',
    }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
    await expect(download(fetchImpl)).rejects.toThrow('Agree to the terms first.');
  });

  test('a server from before the export (its web page for any unknown path) says so', async () => {
    const { fetchImpl } = server(() => new Response('<!doctype html><title>Camphoric</title>', {
      status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }));
    await expect(download(fetchImpl)).rejects.toThrow('the server is older than the event data export');
    expect(await fs.readdir(dir)).toEqual([]);
  });

  test('any other answer that isn\'t JSON is refused', async () => {
    const { fetchImpl } = server(() => new Response('hello', {
      status: 200, headers: { 'Content-Type': 'text/plain' },
    }));
    await expect(download(fetchImpl)).rejects.toThrow('answered with text/plain, not JSON');
    expect(await fs.readdir(dir)).toEqual([]);
  });

  test('a download that breaks off leaves no file', async () => {
    const { fetchImpl } = server(() => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"meta":'));
        controller.error(new Error('connection reset'));
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Disposition': DISPOSITION } }));
    await expect(download(fetchImpl)).rejects.toThrow('connection reset');
    expect(await fs.readdir(dir)).toEqual([]);
  });

  test('a dropped connection (fetch\'s TypeError) says the download broke off', async () => {
    const { fetchImpl } = server(() => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"meta":'));
        controller.error(new TypeError('terminated', { cause: new Error('other side closed') }));
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Disposition': DISPOSITION } }));
    const failure = download(fetchImpl);
    await expect(failure).rejects.toThrow(`the download from ${SERVER} broke off (other side closed)`);
    await expect(failure).rejects.not.toBeInstanceOf(TypeError);
    expect(await fs.readdir(dir)).toEqual([]);
  });

  test('stopped mid-download, the partial file can be removed at once', async () => {
    let fail: (e: Error) => void = () => {};
    let started: () => void = () => {};
    const streaming = new Promise<void>((resolve) => { started = resolve; });
    const { fetchImpl } = server(() => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"meta":'));
        fail = e => controller.error(e);
        started();
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Disposition': DISPOSITION } }));

    const pending = download(fetchImpl);
    await streaming;
    // Wait until the partial file is there
    for (let i = 0; i < 100 && !(await fs.readdir(dir)).length; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect((await fs.readdir(dir))[0]).toMatch(/^\.Lark Camp data 2026-11-17\.json\.\d+\.part$/);

    removePartialDownloads();
    expect(await fs.readdir(dir)).toEqual([]);

    fail(new Error('stopped'));
    await expect(pending).rejects.toThrow('stopped');
  });

  test('an unreachable server says so', async () => {
    const fetchImpl = (async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: new Error('getaddrinfo ENOTFOUND') });
    }) as unknown as typeof fetch;
    await expect(download(fetchImpl)).rejects.toThrow(`couldn't reach ${SERVER} (getaddrinfo ENOTFOUND)`);
  });
});

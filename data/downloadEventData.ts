/**
 * The command line and the steps of download-event-data.ts, which saves all of
 * an event's data as one JSON file, from the server's event data export
 * (`GET /api/events/<id>/export/`, camphoric/camphoric#1016).
 */

import { once } from 'node:events';
import { createWriteStream, rmSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';

import {
  ApiTokenError, MINT_TOKEN_HELP, authorization, isLocalServer, readApiToken, tokenRefusal,
} from '@camphoric/camphoric-event-import-tools/auth';

// Every personal access token starts with this (as getAuthInfo.ts checks for a
// token from the environment)
const TOKEN_PREFIX = 'cmph_';

export const USAGE = [
  'usage: ./download-event-data.ts <eventId> [--output <file>] [--force]',
  '',
  '  Saves all of an event\'s data as one JSON file, from the server at CAMPHORIC_URL.',
  '  The token is CAMPHORIC_API_TOKEN (or the file CAMPHORIC_API_TOKEN_FILE names);',
  '  without either, it\'s asked for, without being shown.',
  '',
  '  --output <file>, -o <file>  where to save it (default: the name the server gives it,',
  '                              "<event name> data <YYYY-MM-DD>.json", in this directory)',
  '  --force                     replace the file if it exists',
  '  --help, -h                  show this',
].join('\n');

export interface DownloadOptions {
  eventId: string;
  output?: string;
  force: boolean;
  help: boolean;
}

/** The options in `args` (the arguments after the script's name). */
export function downloadOptions(args: string[]): DownloadOptions {
  const options: DownloadOptions = { eventId: '', force: false, help: false };
  const eventIds: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--output' || arg === '-o') {
      const file = args[i + 1];
      if (!file || file.startsWith('-')) throw new Error(`${arg} needs a file name; ${USAGE}`);
      options.output = file;
      i += 1;
    } else if (arg.startsWith('--output=')) {
      options.output = arg.slice('--output='.length);
      if (!options.output) throw new Error(`--output needs a file name; ${USAGE}`);
    } else if (arg.startsWith('-')) {
      throw new Error(`unknown option ${arg}; ${USAGE}`);
    } else {
      eventIds.push(arg);
    }
  }

  if (options.help) return options;
  if (eventIds.length !== 1 || !/^[1-9]\d*$/.test(eventIds[0])) {
    throw new Error(`give one event ID; ${USAGE}`);
  }
  options.eventId = eventIds[0];

  return options;
}

/**
 * The server in CAMPHORIC_URL, without a trailing slash. A token goes to it in
 * the clear over http, so http is only for a local server.
 */
export function serverUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.CAMPHORIC_URL?.trim().replace(/\/+$/, '');
  if (!url) {
    throw new Error('set CAMPHORIC_URL to the server to download from, such as https://registration.example.org');
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`CAMPHORIC_URL ('${url}') isn't a server URL, such as https://registration.example.org`);
  }
  if (parsed.protocol === 'http:' && !isLocalServer(url)) {
    throw new Error(`refusing to send an API token over plain http to ${url}: use its https:// address`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`CAMPHORIC_URL ('${url}') isn't an http(s) URL`);
  }

  return url;
}

/** A terminal to read a token from: stdin, as far as a prompt uses it. */
export interface PromptInput {
  isTTY?: boolean;
  isRaw?: boolean;
  setRawMode?(mode: boolean): unknown;
  on(event: 'data', listener: (chunk: Buffer | string) => void): unknown;
  removeListener(event: 'data', listener: (chunk: Buffer | string) => void): unknown;
  resume(): unknown;
  pause(): unknown;
}

/** Where a prompt writes: stderr, so stdout stays clean. */
export interface PromptOutput {
  write(text: string): unknown;
}

/** Thrown when the person stops a prompt with Ctrl-C. */
export class PromptCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'PromptCancelled';
  }
}

/**
 * Ask `question` on a terminal and read the answer without showing it, as a
 * password prompt does. Enter ends it, Backspace deletes, Ctrl-C cancels
 * (PromptCancelled), and Ctrl-D on an empty answer ends it empty.
 */
export function promptHidden(question: string, input: PromptInput, output: PromptOutput): Promise<string> {
  return new Promise((resolve, reject) => {
    let answer = '';
    const wasRaw = input.isRaw ?? false;

    const finish = (error?: Error) => {
      input.removeListener('data', onData);
      input.setRawMode?.(wasRaw);
      input.pause();
      output.write('\n');
      if (error) reject(error);
      else resolve(answer);
    };

    // Where it is in a terminal escape sequence (an arrow key, say, or the
    // markers around a bracketed paste), whose characters aren't typed text:
    // none, just after ESC, or in a control sequence (ESC [ … up to its final
    // character) or a single-shift one (ESC O and one more)
    let escape: 'none' | 'esc' | 'csi' | 'ss3' = 'none';

    function onData(chunk: Buffer | string) {
      for (const char of chunk.toString('utf8')) {
        if (escape === 'esc') {
          escape = char === '[' ? 'csi' : char === 'O' ? 'ss3' : 'none';
          // (Esc on its own: what follows is typed as usual, Enter included)
          if (escape !== 'none') continue;
        }
        if (escape === 'csi') {
          if (char >= '@' && char <= '~') escape = 'none';
          continue;
        }
        if (escape === 'ss3') {
          escape = 'none';
          continue;
        }
        if (char === '\u001b') {
          escape = 'esc';
          continue;
        }
        if (char === '\r' || char === '\n') {
          finish();
          return;
        }
        if (char === '\u0003') { // Ctrl-C
          finish(new PromptCancelled());
          return;
        }
        if (char === '\u0004') { // Ctrl-D
          if (!answer) {
            finish();
            return;
          }
        } else if (char === '\u007f' || char === '\b') { // Backspace
          answer = answer.slice(0, -1);
        } else if (char >= ' ') {
          answer += char;
        }
      }
    }

    output.write(question);
    input.setRawMode?.(true);
    input.on('data', onData);
    input.resume();
  });
}

export interface TokenSources {
  env?: NodeJS.ProcessEnv;
  input?: PromptInput;
  output?: PromptOutput;
  // The server it's for, named in the prompt
  url: string;
}

/**
 * The personal access token: CAMPHORIC_API_TOKEN, or the file
 * CAMPHORIC_API_TOKEN_FILE names, or, with neither set, one typed at a hidden
 * prompt on the terminal.
 */
export async function getToken({
  env = process.env, input = process.stdin, output = process.stderr, url,
}: TokenSources): Promise<string> {
  if (env.CAMPHORIC_API_TOKEN?.trim() || env.CAMPHORIC_API_TOKEN_FILE) return readApiToken(env);

  if (!input.isTTY) {
    throw new ApiTokenError(
      'no API token: set CAMPHORIC_API_TOKEN to a personal access token (or CAMPHORIC_API_TOKEN_FILE '
      + 'to a file holding one), or run this on a terminal to be asked for it.\n'
      + 'Make one in Camphoric from your account menu (Personal access tokens), read-only is enough; or\n'
      + MINT_TOKEN_HELP,
    );
  }

  const token = (await promptHidden(`Personal access token for ${url}: `, input, output)).trim();
  if (!token) throw new ApiTokenError('no API token given');
  if (!token.startsWith(TOKEN_PREFIX)) {
    throw new ApiTokenError(`that isn't a personal access token (they start with ${TOKEN_PREFIX})`);
  }

  return token;
}

/**
 * The file name in a Content-Disposition header, or undefined when it has
 * none. It names a file in the directory the script saves to and nowhere else:
 * anything that would make it a path is replaced.
 */
export function fileNameFrom(contentDisposition: string | null): string | undefined {
  if (!contentDisposition) return undefined;

  let name: string | undefined;
  const extended = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(contentDisposition);
  if (extended) {
    try {
      name = decodeURIComponent(extended[2].trim());
    } catch {
      name = undefined;
    }
  }
  if (!name) {
    const plain = /filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]+))/i.exec(contentDisposition);
    name = plain ? (plain[1] ?? plain[2]).replace(/\\(.)/g, '$1').trim() : undefined;
  }
  if (!name) return undefined;

  // eslint-disable-next-line no-control-regex
  const safe = name.replace(/[/\\\u0000-\u001f\u007f]/g, '_').replace(/^\.+/, '').trim();

  return safe || undefined;
}

/** The name to save under when the server gives none. */
export function fallbackFileName(eventId: string, now: Date): string {
  return `event ${eventId} data ${now.toISOString().slice(0, 10)}.json`;
}

// The partial files of downloads under way, for removePartialDownloads
const partialDownloads = new Set<string>();

/**
 * Remove the partial file of any download under way, at once: for the script
 * to call when it's stopped (Ctrl-C, its terminal closing), which ends it
 * before a download's own clean-up can run. It holds personal data, and
 * hidden, so it mustn't be left behind.
 */
export function removePartialDownloads(): void {
  for (const partial of partialDownloads) {
    rmSync(partial, { force: true });
  }
  partialDownloads.clear();
}

export interface DownloadRequest {
  url: string;
  token: string;
  eventId: string;
  output?: string;
  force: boolean;
  // The directory a file named by the server is saved in
  cwd?: string;
  now?: Date;
  fetchImpl?: typeof fetch;
}

export interface Downloaded {
  file: string;
  bytes: number;
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.lstat(file);
    return true;
  } catch {
    return false;
  }
}

function refusedOverwrite(file: string): Error {
  return new Error(`${file} already exists: give another --output, or --force to replace it`);
}

// What to do about a response that isn't the export
function downloadRefusal(status: number, body: string, url: string, eventId: string): Error {
  const refusal = tokenRefusal(status, body);
  if (refusal && status === 401) {
    return new ApiTokenError(
      `the server refused the API token (401). It's invalid, expired or revoked: make a new one.\n${MINT_TOKEN_HELP}`,
    );
  }
  if (refusal) return refusal;

  let detail = '';
  try {
    const json = JSON.parse(body) as { detail?: unknown };
    if (typeof json.detail === 'string') detail = `: ${json.detail}`;
  } catch {
    detail = body.trim() ? `: ${body.trim().slice(0, 300)}` : '';
  }

  if (status === 403) {
    return new Error(`only an Admin can download an event's data, and the token's user isn't one (403${detail})`);
  }
  if (status === 404) {
    return new Error(
      `${url} has no data export for event ${eventId} (404${detail}): the event doesn't exist, the token's `
      + 'user can\'t see it, or the server is older than the export (camphoric/camphoric#1016)',
    );
  }

  return new Error(`the server couldn't export event ${eventId} (${status}${detail})`);
}

/**
 * Download event `eventId`'s data from the server at `url` and save it, only
 * for its owner to read (it holds personal and payment data). The file is
 * written beside where it goes and moved into place once it's all there, so a
 * failed download never leaves part of one.
 */
export async function downloadEventData({
  url, token, eventId, output, force, cwd = process.cwd(), now = new Date(), fetchImpl = fetch,
}: DownloadRequest): Promise<Downloaded> {
  if (output && !force && await exists(path.resolve(cwd, output))) {
    throw refusedOverwrite(path.resolve(cwd, output));
  }

  const endpoint = `${url}/api/events/${eventId}/export/`;
  let response;
  try {
    response = await fetchImpl(endpoint, { headers: { ...authorization(token), Accept: 'application/json' } });
  } catch (e) {
    const cause = (e as Error).cause as Error | undefined;
    throw new Error(`couldn't reach ${url} (${cause?.message || (e as Error).message})`, { cause: e });
  }

  if (!response.ok) {
    throw downloadRefusal(response.status, await response.text(), url, eventId);
  }

  const type = response.headers.get('content-type') ?? '';
  if (!/\bjson\b/i.test(type)) {
    await response.body?.cancel();
    // The server answers a path it doesn't know, even under /api/, with its web
    // app's page, as one from before the export does
    if (/\bhtml\b/i.test(type)) {
      throw new Error(
        `${url} answered with a web page, not event ${eventId}'s data: the server is older than the event `
        + 'data export (camphoric/camphoric#1016), or CAMPHORIC_URL isn\'t a Camphoric server',
      );
    }
    throw new Error(`${endpoint} answered with ${type || 'no content type'}, not JSON: is CAMPHORIC_URL the server?`);
  }
  if (!response.body) throw new Error(`${endpoint} answered with no data`);

  const file = path.resolve(
    cwd,
    output ?? fileNameFrom(response.headers.get('content-disposition')) ?? fallbackFileName(eventId, now),
  );
  if (!force && await exists(file)) {
    await response.body.cancel();
    throw refusedOverwrite(file);
  }

  const partial = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.part`);
  partialDownloads.add(partial);
  try {
    const out = createWriteStream(partial, { flags: 'wx', mode: 0o600 });
    await once(out, 'open');
    try {
      await pipeline(Readable.fromWeb(response.body as ReadableStream), out);
    } catch (e) {
      // (fetch reports a dropped connection as a TypeError, `terminated`)
      const cause = (e as Error).cause as Error | undefined;
      throw new Error(
        `the download from ${url} broke off (${cause?.message || (e as Error).message}): run it again`,
        { cause: e },
      );
    }
    if (!force && await exists(file)) throw refusedOverwrite(file);
    await fs.rename(partial, file);
  } catch (e) {
    await fs.rm(partial, { force: true });
    throw e;
  } finally {
    partialDownloads.delete(partial);
  }

  const { size } = await fs.stat(file);
  return { file, bytes: size };
}

/** `bytes` for people: 512 B, 3.4 kB, 12.0 MB. */
export function formatSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const units = ['kB', 'MB', 'GB', 'TB'];
  let size = bytes / 1000;
  let unit = 0;
  // (Rounded first, so 999,950 bytes is 1.0 MB, not 1000.0 kB)
  while (Math.round(size * 10) / 10 >= 1000 && unit < units.length - 1) {
    size /= 1000;
    unit += 1;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
}

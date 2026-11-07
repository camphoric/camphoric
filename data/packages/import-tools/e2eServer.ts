/**
 * A Camphoric server for an event's e2e tests: a throwaway one from the
 * release image (Docker needed), or the one CAMPHORIC_E2E_SERVER_URL names.
 */

import { execFile, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { MINT_TOKEN_HELP } from './getAuthInfo.ts';

const run = promisify(execFile);

// How long a throwaway server's token lasts: longer than any suite runs (the
// server, and the token with it, is removed when the tests end)
const THROWAWAY_TOKEN_EXPIRY = '1d';

export interface AdminCredentials {
  username: string;
  password: string;
}

export interface CamphoricServer {
  url: string;
  // An admin's personal access token, to import and administer the event with
  token: string;
  // That admin's username and password, for tests that sign in to the admin
  // client in a browser (which takes a session, not a token): a throwaway
  // server's admin, or CAMPHORIC_E2E_SERVER_USERNAME / _PASSWORD's for an
  // existing server (none when they aren't set)
  admin?: AdminCredentials;
  // A throwaway server's fake PayPal API (e2eFakePayPal.py), which its
  // PAYPAL_BASE_URL names, when it was asked for (none for an existing server)
  payPalUrl?: string;
  // Removes a throwaway server and its data (a no-op for an existing one)
  stop: () => Promise<void>;
}

export interface CamphoricServerOptions {
  // The app image (default: CAMPHORIC_E2E_IMAGE, such as a locally built
  // tag, else ghcr.io/camphoric/camphoric:<CAMPHORIC_IMAGE_TAG or latest>,
  // pulled fresh each run)
  image?: string;
  // Also start the fake PayPal API (default: no), for online payment. It's
  // mounted from this package, so Docker must see its files.
  fakePayPal?: boolean;
}

// This package's e2e-compose.yml, from its source or its build in dist/
function composeFile(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (!fs.existsSync(path.join(dir, 'e2e-compose.yml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('e2e-compose.yml not found');
    dir = parent;
  }
  return path.join(dir, 'e2e-compose.yml');
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

type Compose = (...args: string[]) => Promise<{ stdout: string, stderr: string }>;

// Start the compose project, until the app's healthcheck passes (migrated and
// serving, its admin created)
async function startServer(compose: Compose): Promise<void> {
  try {
    await compose('up', '-d', '--wait', '--quiet-pull');
  } catch (e) {
    const logs = await compose('logs', '--tail', '50').then(r => r.stdout, () => '');
    throw new Error(`the throwaway Camphoric didn't start: ${(e as Error).message}\n${logs}`, { cause: e });
  }
}

// Mint a token for the throwaway server's admin, in its app service (the
// command prints only the token on stdout)
async function mintAdminToken(compose: Compose, username: string): Promise<string> {
  try {
    const minted = await compose('exec', '-T', 'app', 'python', 'manage.py', 'camphoric_api_token', 'create',
      username, '--name', 'e2e', '--expires', THROWAWAY_TOKEN_EXPIRY);
    return minted.stdout.trim();
  } catch (e) {
    // (An image from before personal access tokens has no such command)
    throw new Error(`couldn't mint the throwaway Camphoric's API token: ${(e as Error).message}`, { cause: e });
  }
}

/**
 * Start a throwaway Camphoric, ready for requests, with a token minted for
 * its admin. To use an existing server instead (it gets the event imported
 * into it), set CAMPHORIC_E2E_SERVER_URL, with an admin's personal access
 * token in CAMPHORIC_E2E_SERVER_TOKEN, and, for tests that sign in to the
 * admin client, that admin's CAMPHORIC_E2E_SERVER_USERNAME / _PASSWORD. (Not CAMPHORIC_URL and
 * CAMPHORIC_API_TOKEN, which the importer's other tools use, so tests never
 * import into a development server by accident.)
 */
export async function camphoricServer(options: CamphoricServerOptions = {}): Promise<CamphoricServer> {
  const existing = process.env.CAMPHORIC_E2E_SERVER_URL;
  if (existing) {
    const token = process.env.CAMPHORIC_E2E_SERVER_TOKEN?.trim();
    if (!token) {
      const passwordNote = process.env.CAMPHORIC_E2E_SERVER_USERNAME || process.env.CAMPHORIC_E2E_SERVER_PASSWORD
        ? ' (CAMPHORIC_E2E_SERVER_USERNAME / _PASSWORD only sign in to the admin client in a browser)'
        : '';
      throw new Error(
        `CAMPHORIC_E2E_SERVER_URL needs CAMPHORIC_E2E_SERVER_TOKEN, an admin's personal access token${passwordNote}.\n`
        + MINT_TOKEN_HELP,
      );
    }
    const { CAMPHORIC_E2E_SERVER_USERNAME: username, CAMPHORIC_E2E_SERVER_PASSWORD: password } = process.env;
    return {
      url: existing.replace(/\/$/, ''),
      token,
      admin: username && password ? { username, password } : undefined,
      stop: async () => {},
    };
  }

  const port = await freePort();
  let payPalPort = await freePort();
  while (payPalPort === port) payPalPort = await freePort();
  const fakePayPal = options.fakePayPal ?? false;
  // The admin the image's entrypoint creates, whom the token is minted for
  // (its password is for tests that sign in to the admin client)
  const username = 'e2e-admin';
  const password = randomBytes(12).toString('hex');
  const project = `camphoric-e2e-${randomBytes(4).toString('hex')}`;
  const local = options.image ?? process.env.CAMPHORIC_E2E_IMAGE;
  const env = {
    ...process.env,
    CAMPHORIC_E2E_IMAGE: local ?? `ghcr.io/camphoric/camphoric:${process.env.CAMPHORIC_IMAGE_TAG ?? 'latest'}`,
    CAMPHORIC_E2E_PULL_POLICY: local ? 'missing' : 'always',
    CAMPHORIC_E2E_PORT: String(port),
    CAMPHORIC_E2E_PAYPAL_PORT: String(payPalPort),
    // (for every compose command, so `down` removes the fake PayPal too)
    COMPOSE_PROFILES: fakePayPal ? 'paypal' : '',
    CAMPHORIC_E2E_USERNAME: username,
    CAMPHORIC_E2E_PASSWORD: password,
  };
  const composeArgs = ['compose', '-p', project, '-f', composeFile()];
  const compose: Compose = (...args) => run('docker', [...composeArgs, ...args], {
    env, maxBuffer: 16 * 1024 * 1024,
  });
  const stop = async () => {
    await compose('down', '-v', '--remove-orphans');
  };

  // Interrupted while starting (before there's anything to tear it down),
  // remove what has started so far rather than leave it running
  const interrupted = (signal: NodeJS.Signals) => {
    spawnSync('docker', [...composeArgs, 'down', '-v', '--remove-orphans'], { env, stdio: 'ignore' });
    process.kill(process.pid, signal);
  };
  process.once('SIGINT', interrupted);
  process.once('SIGTERM', interrupted);

  let token: string;
  try {
    await startServer(compose);
    token = await mintAdminToken(compose, username);
  } catch (e) {
    await stop().catch(() => {});
    throw e;
  } finally {
    process.off('SIGINT', interrupted);
    process.off('SIGTERM', interrupted);
  }

  return {
    url: `http://localhost:${port}`,
    token,
    admin: { username, password },
    payPalUrl: fakePayPal ? `http://127.0.0.1:${payPalPort}` : undefined,
    stop,
  };
}

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

const run = promisify(execFile);

export interface CamphoricServer {
  url: string;
  // the admin to import as
  username: string;
  password: string;
  // Removes a throwaway server and its data (a no-op for an existing one)
  stop: () => Promise<void>;
}

export interface CamphoricServerOptions {
  // The app image (default: CAMPHORIC_E2E_IMAGE, such as a locally built
  // tag, else ghcr.io/camphoric/camphoric:<CAMPHORIC_IMAGE_TAG or latest>,
  // pulled fresh each run)
  image?: string;
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

/**
 * Start a throwaway Camphoric, ready for requests. To use an existing server
 * instead (it gets the event imported into it), set CAMPHORIC_E2E_SERVER_URL,
 * with its admin in CAMPHORIC_E2E_SERVER_USERNAME / _PASSWORD. (Not
 * CAMPHORIC_URL, which the importer's other tools use, so tests never import
 * into a development server by accident.)
 */
export async function camphoricServer(options: CamphoricServerOptions = {}): Promise<CamphoricServer> {
  const existing = process.env.CAMPHORIC_E2E_SERVER_URL;
  if (existing) {
    const { CAMPHORIC_E2E_SERVER_USERNAME: username, CAMPHORIC_E2E_SERVER_PASSWORD: password } = process.env;
    if (!username || !password) {
      throw new Error('CAMPHORIC_E2E_SERVER_URL needs CAMPHORIC_E2E_SERVER_USERNAME and CAMPHORIC_E2E_SERVER_PASSWORD');
    }
    return { url: existing.replace(/\/$/, ''), username, password, stop: async () => {} };
  }

  const port = await freePort();
  const username = 'e2e-admin';
  const password = randomBytes(12).toString('hex');
  const project = `camphoric-e2e-${randomBytes(4).toString('hex')}`;
  const local = options.image ?? process.env.CAMPHORIC_E2E_IMAGE;
  const env = {
    ...process.env,
    CAMPHORIC_E2E_IMAGE: local ?? `ghcr.io/camphoric/camphoric:${process.env.CAMPHORIC_IMAGE_TAG ?? 'latest'}`,
    CAMPHORIC_E2E_PULL_POLICY: local ? 'missing' : 'always',
    CAMPHORIC_E2E_PORT: String(port),
    CAMPHORIC_E2E_USERNAME: username,
    CAMPHORIC_E2E_PASSWORD: password,
  };
  const composeArgs = ['compose', '-p', project, '-f', composeFile()];
  const compose = (...args: string[]) => run('docker', [...composeArgs, ...args], {
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

  try {
    // --wait: until the app's healthcheck passes (migrated and serving)
    await compose('up', '-d', '--wait', '--quiet-pull');
  } catch (e) {
    const logs = await compose('logs', '--tail', '50').then(r => r.stdout, () => '');
    await stop().catch(() => {});
    throw new Error(`the throwaway Camphoric didn't start: ${(e as Error).message}\n${logs}`, { cause: e });
  } finally {
    process.off('SIGINT', interrupted);
    process.off('SIGTERM', interrupted);
  }

  return { url: `http://localhost:${port}`, username, password, stop };
}

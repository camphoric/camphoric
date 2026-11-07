import fs from 'node:fs/promises';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';

// The servers these tools use without CAMPHORIC_ALLOW_REMOTE=1: this machine
// (as the Vagrant VM's import and CI's use), and the development stack's
// django service (docker-compose.yml), which its data service imports into.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', 'django'];
const LOCAL_DOMAINS = ['.localhost', '.test'];

// Every personal access token starts with this (the server tells them from an
// OAuth app's bearer token by it)
const TOKEN_PREFIX = 'cmph_';
// How much of a token the server shows to identify it (`camphoric_api_token
// list`), and so what `camphoric_api_token revoke` takes
const TOKEN_ID_LENGTH = 13;

/** How to mint a personal access token, for the messages that need one. */
export const MINT_TOKEN_HELP = [
  'Mint one on the server for your user (it prints only the token, so $(…) captures it; it lasts',
  'an hour unless given --expires):',
  '  ./manage.py camphoric_api_token create <you>                                  (in server/)',
  '  docker compose exec -T django ./manage.py camphoric_api_token create <you>    (the development stack)',
  '  docker compose exec -T app python manage.py camphoric_api_token create <you>  (the release image)',
  '  vagrant ssh -c "cd /vagrant/server && pipenv run python manage.py camphoric_api_token create <you>"',
  '                                                                                (the Vagrant VM)',
].join('\n');

/**
 * A problem with the API token: there's none, or the server refused it. It
 * says what to do about it, so it's worth showing without a stack.
 */
export class ApiTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiTokenError';
  }
}

/** Whether `url` is a local development server (see LOCAL_HOSTS). */
export function isLocalServer(url: string): boolean {
  let hostname;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error(`'${url}' isn't a server URL (set CAMPHORIC_URL to one, such as http://localhost:8000)`);
  }
  // (An IPv6 hostname keeps its brackets, and a fully qualified one its dot)
  hostname = hostname.replace(/^\[(.*)\]$/, '$1').replace(/\.$/, '');

  return LOCAL_HOSTS.includes(hostname) || LOCAL_DOMAINS.some(domain => hostname.endsWith(domain));
}

/**
 * Refuse a server that isn't local unless CAMPHORIC_ALLOW_REMOTE=1. Importing
 * replaces any event with the same name, deletes its lodging and posts sample
 * registrations, so a stray CAMPHORIC_URL (say, in data/.env) mustn't aim it
 * at a live server.
 */
export function assertLocalServer(url: string, env: NodeJS.ProcessEnv = process.env): void {
  if (env.CAMPHORIC_ALLOW_REMOTE === '1' || isLocalServer(url)) return;

  throw new Error(
    `refusing to use ${url}: it isn't a local server (localhost, 127.0.0.1, ::1, *.localhost, `
    + '*.test or django), and an import replaces events with the same name and deletes their '
    + 'lodging. Set CAMPHORIC_ALLOW_REMOTE=1 to use it anyway.',
  );
}

/**
 * The headers that send `token`: every request the tools make with a token
 * builds its Authorization header here.
 */
export function authorization(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/**
 * The personal access token in CAMPHORIC_API_TOKEN or, when that's unset, in
 * the file CAMPHORIC_API_TOKEN_FILE names (as the development stack's data
 * service has it). Read each time, so a token minted again (the stack mints
 * one whenever its server starts) is the one used.
 */
export async function readApiToken(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  let token = env.CAMPHORIC_API_TOKEN?.trim();
  let source = 'CAMPHORIC_API_TOKEN';

  if (!token && env.CAMPHORIC_API_TOKEN_FILE) {
    source = `CAMPHORIC_API_TOKEN_FILE (${env.CAMPHORIC_API_TOKEN_FILE})`;
    try {
      token = (await fs.readFile(env.CAMPHORIC_API_TOKEN_FILE, 'utf8')).trim();
    } catch (e) {
      throw new ApiTokenError(`couldn't read ${source}: ${(e as Error).message}\n${MINT_TOKEN_HELP}`);
    }
    if (!token) throw new ApiTokenError(`${source} is empty\n${MINT_TOKEN_HELP}`);
  }

  if (!token) {
    // (The superuser's password is in the development stack's environment for
    // the server, so its presence says nothing about how the tools sign in)
    const passwordNote = env.DJANGO_SUPERUSER_PASSWORD
      ? ' The tools no longer sign in with DJANGO_SUPERUSER_USERNAME / _PASSWORD.'
      : '';
    throw new ApiTokenError(
      'no API token: set CAMPHORIC_API_TOKEN to a personal access token (or CAMPHORIC_API_TOKEN_FILE '
      + `to a file holding one).${passwordNote}\n${MINT_TOKEN_HELP}`,
    );
  }

  // (The server would hand anything else to its OAuth authentication, whose
  // failures it throttles, and the old per-user tokens are gone)
  if (!token.startsWith(TOKEN_PREFIX)) {
    throw new ApiTokenError(
      `${source} isn't a personal access token (they start with ${TOKEN_PREFIX}).\n${MINT_TOKEN_HELP}`,
    );
  }

  return token;
}

/**
 * The API token to use with the server at `url`.
 *
 * Every tool gets its token here before it changes anything, so this is where
 * a remote server is refused: before the token is read, so it's never sent
 * to a server the check refuses.
 */
export async function getAuthToken(url = urlBase): Promise<string> {
  assertLocalServer(url);

  return readApiToken();
}

/** The part of a token that identifies it to `camphoric_api_token list` and `revoke`. */
export function tokenId(token: string): string {
  return token.slice(0, TOKEN_ID_LENGTH);
}

// A JSON error body's fields, or none when it isn't one
function errorBody(body: string): Record<string, unknown> {
  try {
    const json: unknown = JSON.parse(body);
    return json && typeof json === 'object' && !Array.isArray(json) ? json as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

/**
 * What to do about a response that refused the token (`status` and its
 * `body` as text), or undefined when it didn't: an invalid, expired or
 * revoked token (401), a read-only one (403 `read_only_token`), or terms the
 * token's user has yet to agree to (403 `contract_agreement_required`, which
 * names the organization and where to agree).
 */
export function tokenRefusal(status: number, body: string): ApiTokenError | undefined {
  const { detail, code, organization_name: organizationName, contract_url: contractUrl } = errorBody(body);
  const said = typeof detail === 'string' && detail ? `: ${detail}` : '';

  if (status === 401) {
    return new ApiTokenError(
      `the server refused the API token (401${said}). It's invalid, expired or revoked: `
      + 'set CAMPHORIC_API_TOKEN to a new one (in the development stack, `docker compose restart django` '
      + `mints the data service's again).\n${MINT_TOKEN_HELP}`,
    );
  }

  if (status === 403 && code === 'read_only_token') {
    return new ApiTokenError(
      `the API token is read-only (403${said}), and these tools change data: mint one without --read-only.`,
    );
  }

  if (status === 403 && code === 'contract_agreement_required') {
    return new ApiTokenError([
      typeof detail === 'string' && detail ? detail : 'The token\'s user has terms to agree to.',
      `Organization: ${typeof organizationName === 'string' ? organizationName : '(not named)'}`,
      typeof contractUrl === 'string' && contractUrl
        ? `Agree to its terms at ${contractUrl} (signed in as the token's user), then run this again.`
        : 'Sign in to Camphoric\'s admin as the token\'s user to agree to its terms, then run this again.',
    ].join('\n'));
  }

  return undefined;
}

/** Throw tokenRefusal's error for a response that refused the token. */
export function assertTokenAccepted(status: number, body: string): void {
  const refusal = tokenRefusal(status, body);
  if (refusal) throw refusal;
}

/**
 * Revoke `token` on the server at `url` (DELETE /api/user/tokens/current), as
 * a run made with a token minted for it does when it ends. A token the
 * server already refuses (expired, or revoked) has nothing left to revoke.
 */
export async function revokeAuthToken(
  url: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<'revoked' | 'already ended'> {
  assertLocalServer(url);

  const cleanUp = `revoke it on the server with \`camphoric_api_token revoke ${tokenId(token)}\``;
  let response;
  try {
    response = await fetchImpl(`${url}/api/user/tokens/current`, { method: 'DELETE', headers: authorization(token) });
  } catch (e) {
    const cause = (e as Error).cause as Error | undefined;
    throw new ApiTokenError(`couldn't revoke the API token (${cause?.message || (e as Error).message}): ${cleanUp}`);
  }

  if (response.ok) return 'revoked';
  if (response.status === 401) return 'already ended';

  const body = await response.text();
  throw new ApiTokenError(`couldn't revoke the API token (${response.status}: ${body.slice(0, 500)}): ${cleanUp}`);
}

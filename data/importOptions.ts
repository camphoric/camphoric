/**
 * The importer's command line, and the checks its options make.
 */

import { ApiTokenError, assertTokenAccepted, authorization } from '@camphoric/camphoric-event-import-tools/auth';

export interface ImportOptions {
  // Import only into a server with no events at all (a fresh database), as a
  // development environment does when it starts, like the Vagrant VM: it
  // never adds to a database in use (importing an event again deletes and
  // recreates its lodging, and unassigns its campers).
  ifEmpty: boolean;
  // Wait for the server to answer before importing (as when it's starting
  // alongside the importer), instead of failing at once.
  wait: boolean;
  // Revoke the API token when the run ends, however it ends (DELETE
  // /api/user/tokens/current), so a token minted for the run works for it
  // alone. Off by default: a run mustn't end a long-lived token its user
  // keeps for more.
  revokeToken: boolean;
}

const OPTIONS = { '--if-empty': 'ifEmpty', '--wait': 'wait', '--revoke-token': 'revokeToken' } as const;

export function importOptions(args: string[]): ImportOptions {
  const unknown = args.filter(arg => !Object.hasOwn(OPTIONS, arg));
  if (unknown.length) {
    throw new Error(`unknown option ${unknown.join(' ')}; the importer takes ${Object.keys(OPTIONS).join(', ')}`);
  }

  return {
    ifEmpty: args.includes('--if-empty'),
    wait: args.includes('--wait'),
    revokeToken: args.includes('--revoke-token'),
  };
}

// GET a path of the server's API with the token, answering its JSON; `doing`
// says what for, in the error when it fails
async function getJson(url: string, token: string, doing: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url, { headers: authorization(token) });
  const text = await response.text();
  assertTokenAccepted(response.status, text);
  if (!response.ok) {
    throw new Error(`couldn't ${doing} (${response.status})`);
  }

  return JSON.parse(text);
}

/**
 * The names of the events the server has (seen with an admin's token).
 *
 * The server leaves out of its events list the events of any organization
 * whose terms the token's user has yet to agree to, so a user with terms
 * pending fails this, rather than see fewer events than there are.
 */
export async function serverEventNames(urlBase: string, token: string, fetchImpl = fetch): Promise<Set<string>> {
  const user = await getJson(`${urlBase}/api/user`, token, 'see who the token is for', fetchImpl);
  const pending = (user as { pending_contract_organizations?: unknown } | null)?.pending_contract_organizations;
  if (!Array.isArray(pending)) {
    throw new Error('the server didn\'t say whether the token\'s user has terms to agree to');
  }
  if (pending.length) {
    const who = (user as { username?: unknown }).username;
    const organizations = `organization${pending.length === 1 ? '' : 's'} ${pending.join(', ')} (by id)`;
    throw new ApiTokenError(
      `${typeof who === 'string' ? who : 'the token\'s user'} has yet to agree to the terms of ${organizations}, `
      + 'whose events the server leaves out of its events list until they do, so --if-empty can\'t tell '
      + 'whether it has any. Sign in to Camphoric\'s admin as that user and agree to them, then run this again.',
    );
  }

  const events = await getJson(`${urlBase}/api/events/`, token, 'list the server\'s events', fetchImpl);
  // A list the importer doesn't understand mustn't read as "no events"
  if (!Array.isArray(events)) {
    throw new Error('the server\'s events list isn\'t a list');
  }

  return new Set(events.map(event => (event as { name: string }).name));
}

/**
 * Wait until the server answers: any response under 500 (even a refusal) means
 * it's up, while no connection or a 5xx means it's still starting.
 */
export async function waitForServer(urlBase: string, {
  timeoutMs = 10 * 60 * 1000,
  intervalMs = 2000,
  fetchImpl = fetch,
  log = console.log,
} = {}): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastProblem: string;
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetchImpl(`${urlBase}/api/set-csrf-cookie`);
      if (response.status < 500) return;
      lastProblem = `it answers ${response.status}`;
    } catch (e) {
      // (A refused connection's cause can be an AggregateError with no message)
      const cause = (e as Error).cause as (Error & { code?: string }) | undefined;
      lastProblem = cause?.message || cause?.code || (e as Error).message || String(e);
    }

    if (Date.now() >= deadline) {
      throw new Error(`${urlBase} didn't start in time: ${lastProblem}`);
    }
    if (attempt === 0) log(`waiting for ${urlBase} to start…`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

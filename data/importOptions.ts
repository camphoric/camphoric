/**
 * The importer's command line, and the checks its options make.
 */

export interface ImportOptions {
  // Import only into a server with no events at all (a fresh database), as a
  // development environment does when it starts, like the Vagrant VM: it
  // never adds to a database in use (importing an event again deletes and
  // recreates its lodging, and unassigns its campers).
  ifEmpty: boolean;
  // Wait for the server to answer before importing (as when it's starting
  // alongside the importer), instead of failing at once.
  wait: boolean;
}

const OPTIONS = { '--if-empty': 'ifEmpty', '--wait': 'wait' } as const;

export function importOptions(args: string[]): ImportOptions {
  const unknown = args.filter(arg => !Object.hasOwn(OPTIONS, arg));
  if (unknown.length) {
    throw new Error(`unknown option ${unknown.join(' ')}; the importer takes ${Object.keys(OPTIONS).join(', ')}`);
  }

  return { ifEmpty: args.includes('--if-empty'), wait: args.includes('--wait') };
}

/** The names of the events the server has (seen with an admin's token). */
export async function serverEventNames(urlBase: string, token: string, fetchImpl = fetch): Promise<Set<string>> {
  const response = await fetchImpl(`${urlBase}/api/events/`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!response.ok) {
    throw new Error(`couldn't list the server's events (${response.status})`);
  }

  const events: unknown = await response.json();
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

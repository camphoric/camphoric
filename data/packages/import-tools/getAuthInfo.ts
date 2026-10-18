import inquirer from 'inquirer';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';

// The servers these tools use without CAMPHORIC_ALLOW_REMOTE=1: this machine
// (as the Vagrant VM's import and CI's use), and the development stack's
// django service (docker-compose.yml), which its data service imports into.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', 'django'];
const LOCAL_DOMAINS = ['.localhost', '.test'];

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

// Every tool logs in here before it changes anything, so this is where a
// remote server is refused.
export async function getAuthToken(url = urlBase): Promise<string> {
  assertLocalServer(url);

  let username = process.env.DJANGO_SUPERUSER_USERNAME;
  let password = process.env.DJANGO_SUPERUSER_PASSWORD;

  if (!username && !password) {
    const answers = await inquirer.prompt<{ username: string, password: string }>([
      { type: 'input', name: 'username', message: 'username:' },
      { type: 'password', name: 'password', message: 'password:' },
    ]);

    username = answers.username;
    password = answers.password;
  }

  const response = await fetch(`${url}/api-token-auth/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(username ?? '')}&password=${encodeURIComponent(password ?? '')}`,
  });
  const json = await response.json() as { token?: string };
  const { token } = json;
  if (!token) {
    throw new Error(JSON.stringify(json));
  }

  return token;
}

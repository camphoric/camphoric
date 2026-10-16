import inquirer from 'inquirer';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';

export async function getAuthToken(url = urlBase): Promise<string> {
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

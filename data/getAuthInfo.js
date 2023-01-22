
const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';

export async function getAuthToken() {
  let username = process.env.DJANGO_SUPERUSER_USERNAME;
  let password = process.env.DJANGO_SUPERUSER_PASSWORD;

  if (!username && !password) {
    const answers = await inquirer.prompt([
      { name: 'username' },
      { name: 'password', type: 'password' },
    ]);

    username = answers.username;
    password = answers.password;
  }

  const response = await fetch(`${urlBase}/api-token-auth/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
  });
  const json = await response.json();
  const { token } = json;
  if (!token) {
    throw new Error(JSON.stringify(json));
  }

  return token;
}

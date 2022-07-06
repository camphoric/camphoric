import fetch from 'node-fetch';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';

function extractCookieString(response) {
  return response.headers.raw()['set-cookie'].map(
    c => {
      const m = c.match(/^([^=]+=[^;]+)/);

      return m[1];
    }
  ).join('; ');
}

async function getAuthInfo() {
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

  let response;
  let cookies;
  let match;
  let csrf;
  let rawHeaders;

  response = await fetch(`${urlBase}/api/set-csrf-cookie`);
  rawHeaders = response.headers.raw();
  // console.log('rawHeaders', rawHeaders);
  cookies = rawHeaders['set-cookie'];
  match = cookies[0].match(/\bcsrftoken=([^;]+)/);
  csrf = (match && match[1]) || '';

  response = await fetch(`${urlBase}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
      cookie: `csrftoken=${csrf}`,
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  console.log('login response', response.status);

  const cookie = extractCookieString(response);
  cookies = response.headers.raw()['set-cookie'];
  match = cookies[0].match(/\bcsrftoken=([^;]+)/);
  csrf = (match && match[1]) || '';

  return {
    'Content-Type': 'application/json',
    'X-CSRFToken': csrf,
    cookie,
  };
}

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
    body: `username=${username}&password=${password}`,
  });
  const json = await response.json();
  const { token } = json;
  if (!token) {
    throw new Error(JSON.stringify(json));
  }

  return token;
}


export default getAuthInfo;

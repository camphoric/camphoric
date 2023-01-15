type Method = 'GET' | 'PUT' | 'POST' | 'DELETE';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';
let tokenPromise;

export const apiFetch = async (
  url: string,
  method: Method = 'GET',
  body: {} | null = null,
) => {
  let text;
  let value;

  const token = await getAuthToken();

  try {
    const res = await fetch(
      `${urlBase}${url}`,
      {
        method,
        credentials: 'include',
        headers: new Headers({
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`,
        }),
        ...(
          body ? { body: JSON.stringify(body) } : {}
        )
      },
    );

    text = await res.text();
    value = JSON.parse(text);
  } catch (e) {
    console.error(`problem with ${url}`);
    console.log('text');
    throw e;
  }

  return value;
}

export const mockAttributes = (obj: {}, attrs: string[] = []) => {
  [
    'id',
    'created_at',
    'updated_at',
    'deleted_at',
    'event',
    'uuid',
    ...attrs,
  ].forEach(a => {
    try {
      delete obj[a];
    } catch (e) {
      // do nothing
    }
  });

  return obj;
}

export function getAuthToken() {
  if (tokenPromise) return tokenPromise;

  tokenPromise = new Promise(async (resolve) => {
    let username = process.env.DJANGO_SUPERUSER_USERNAME;
    let password = process.env.DJANGO_SUPERUSER_PASSWORD;

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

    resolve(token);
  });

  return tokenPromise;
}

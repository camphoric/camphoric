export function getCsrfToken() {
  const match = document.cookie.match(/\bcsrftoken=([^;]+)/);

  return (match && match[1]) || '';
}

type Method = 'GET' | 'PUT' | 'POST' | 'DELETE';

export function apiFetch(
  url: string,
  method: Method = 'GET',
  body: {} | null = null,
  extraHeaders: {} = {}
) {
  return fetch(
    url,
    {
      method,
      credentials: 'include',
      headers: new Headers({
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
        ...extraHeaders,
      }),
      ...(
        body ? { body: JSON.stringify(body) } : {}
      )
    },
  );
}

export function getCsrfToken() {
  const match = document.cookie.match(/\bcsrftoken=([^;]+)/);

  return (match && match[1]) || '';
}

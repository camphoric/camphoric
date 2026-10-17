/**
 * How the router reads and writes search params (SPEC §4; §15, DR-83): every
 * value is a plain string — `?reportId=71`, not the router's default
 * `?reportId=%2271%22`, which JSON-quotes a string that looks like a number so
 * it reads back as a string. Reading never turns a value into a number, so a
 * typed or pasted `?reportId=71` selects the report too, and the query string
 * the registration flow sends to the server (an invitation code) is the one in
 * the address bar. Links made with quoted values still read the same.
 */

/** A value written JSON-quoted (`"71"`), as the router's default did: its string. */
function unquote(value: string): string {
  if (value.length < 2 || !value.startsWith('"') || !value.endsWith('"')) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : value;
  } catch {
    return value;
  }
}

export function parseSearch(searchStr: string): Record<string, string> {
  const search: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(searchStr)) search[key] = unquote(value);
  return search;
}

/** `?key=value&…`, leaving out what's empty; '' when nothing's left. */
export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === '') continue;
    // Search params are strings (AdminSearch); anything else is written as JSON.
    params.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

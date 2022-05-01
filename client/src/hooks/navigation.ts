import { useLocation } from 'react-router-dom';

// A custom hook that builds on useLocation to parse
// the query string for you.
export function useQuery(type: undefined): URLSearchParams;
export function useQuery(type: string): string;
export function useQuery(name?: string) {
  const params = new URLSearchParams(useLocation().search);

  if (name) return params.get(name);

  return params;
}

export function useQueryLookup() {
  const searchParams = new URLSearchParams(useLocation().search);

  return Object.fromEntries(searchParams.entries());
}

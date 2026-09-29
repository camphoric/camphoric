/**
 * Keep a tab (or view toggle) selection in a URL search param, so it's linkable
 * and back/forward returns to the same tab (SPEC §4, §8.2). A missing or
 * unavailable value falls back to the first allowed tab, and choosing that
 * default drops the param to keep URLs short. Each change is a history entry.
 */

import { useNavigate, useSearch } from '@tanstack/react-router';

export function useSearchTab<T extends string>(
  param: string,
  allowed: readonly T[],
): [T, (value: string | null) => void] {
  const search: Record<string, unknown> = useSearch({ strict: false });
  const navigate = useNavigate();

  const current = search[param];
  const tab = allowed.find((t) => t === current) ?? allowed[0];

  const setTab = (value: string | null) =>
    void navigate({
      to: '.',
      // Search params are strings (the admin routes' AdminSearch contract, SPEC §4).
      search: (prev: Record<string, string | undefined>) => ({
        ...prev,
        [param]: value && value !== allowed[0] ? value : undefined,
      }),
    });

  return [tab, setTab];
}

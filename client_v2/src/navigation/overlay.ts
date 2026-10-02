/**
 * Admin overlays (SPEC §4, §8.10; §15, DR-84): screens that open over whatever
 * admin page is showing, kept in that page's URL (`?overlay=users`), so the
 * page stays as it was underneath and closing the overlay returns to it.
 */

import { useLocation, useNavigate, useRouter } from '@tanstack/react-router';

import { parseSearch, stringifySearch } from './search';

export type Overlay = 'users';

/** The search params that belong to an overlay rather than to the page under it. */
export const OVERLAY_PARAMS = ['overlay', 'userId', 'historyUserId'];

type Search = Record<string, string | undefined>;

export function useOverlay() {
  const location = useLocation();
  const navigate = useNavigate();
  const search: Search = location.search;
  // Same page, new search: the page under the overlay isn't touched.
  const setSearch = (changes: Search) =>
    void navigate({ href: location.pathname + stringifySearch({ ...search, ...changes }) });
  return {
    overlay: search.overlay as Overlay | undefined,
    search,
    setSearch,
    open: (overlay: Overlay) => setSearch({ overlay }),
    close: () => setSearch(Object.fromEntries(OVERLAY_PARAMS.map((key) => [key, undefined]))),
  };
}

/**
 * Open an overlay over the current page — for a menu that's shown on every
 * page. It reads where it is only when used, so it needs no router to render
 * (outside one, in stories, it does nothing).
 */
export function useOpenOverlay() {
  const router = useRouter({ warn: false }) as
    | {
        state: { location: { pathname: string; search: Search } };
        navigate: (options: { href: string }) => Promise<void>;
      }
    | undefined;
  return (overlay: Overlay) => {
    if (!router) return;
    const { pathname, search } = router.state.location;
    void router.navigate({ href: pathname + stringifySearch({ ...search, overlay }) });
  };
}

interface Place {
  pathname: string;
  search: string;
}

/** Whether going from one URL to the next only opens, closes or changes an overlay. */
export function onlyOverlayChanged(from: Place, to: Place): boolean {
  if (from.pathname !== to.pathname) return false;
  const [before, after] = [parseSearch(from.search), parseSearch(to.search)];
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].every(
    (key) => OVERLAY_PARAMS.includes(key) || before[key] === after[key],
  );
}

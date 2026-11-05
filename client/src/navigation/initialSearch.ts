/**
 * The query string the page was loaded with (without its `?`), as it was before the
 * router rewrites the address into its own form of search params (DR-83), which can
 * change values (a quoted one loses its quotes, an empty one goes). The OAuth page
 * passes an app's request on exactly as the app sent it (SPEC §6; §15 DR-152). The
 * router imports this first, so it's read before the router starts.
 */
export const initialSearch: string =
  typeof window === 'undefined' ? '' : window.location.search.replace(/^\?/, '');

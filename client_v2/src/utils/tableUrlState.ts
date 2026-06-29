/**
 * Encode/decode a DataTable's state to URL search params (SPEC §8.2, DR-2,
 * DR-19) so admin table sort/filter/page is shareable and survives the back
 * button. Params are namespaced by a per-table prefix (so several tables can
 * share one route's search): `${prefix}q`, `${prefix}sort`, `${prefix}page`.
 *
 * `sort` is `"<columnId>"` (ascending) or `"<columnId>:desc"`; `page` is
 * 1-based in the URL (omitted on page 1); defaults are omitted entirely.
 */

import type { DataTableState } from 'components/DataTable';

type Search = Record<string, string | undefined>;

export function tableStateFromSearch(search: Search, prefix: string): DataTableState {
  const sortRaw = search[`${prefix}sort`];
  const sorting = sortRaw
    ? [{ id: sortRaw.replace(/:desc$/, ''), desc: sortRaw.endsWith(':desc') }]
    : [];
  const globalFilter = search[`${prefix}q`] ?? '';
  const page = Number(search[`${prefix}page`]) || 1;
  return { sorting, globalFilter, pageIndex: Math.max(0, page - 1) };
}

export function tableStateToSearch(state: DataTableState, prefix: string): Search {
  const sort = state.sorting[0];
  return {
    [`${prefix}sort`]: sort ? (sort.desc ? `${sort.id}:desc` : sort.id) : undefined,
    [`${prefix}q`]: state.globalFilter || undefined,
    [`${prefix}page`]: state.pageIndex > 0 ? String(state.pageIndex + 1) : undefined,
  };
}

import type { DataTableState } from 'components/DataTable';
import { describe, expect, it } from 'vitest';

import { tableStateFromSearch, tableStateToSearch } from './tableUrlState';

describe('tableStateFromSearch', () => {
  it('defaults to empty state when no params are present', () => {
    expect(tableStateFromSearch({}, 'reg')).toEqual({
      sorting: [],
      globalFilter: '',
      pageIndex: 0,
    });
  });

  it('decodes namespaced sort / filter / page (page is 1-based in the URL)', () => {
    const search = { regsort: 'owed:desc', regq: 'smith', regpage: '3' };
    expect(tableStateFromSearch(search, 'reg')).toEqual({
      sorting: [{ id: 'owed', desc: true }],
      globalFilter: 'smith',
      pageIndex: 2,
    });
  });

  it('treats a bare column id as ascending', () => {
    expect(tableStateFromSearch({ regsort: 'name' }, 'reg').sorting).toEqual([
      { id: 'name', desc: false },
    ]);
  });

  it('reads only its own prefix (no cross-table collision)', () => {
    const search = { regq: 'alice', invq: 'bob' };
    expect(tableStateFromSearch(search, 'reg').globalFilter).toBe('alice');
    expect(tableStateFromSearch(search, 'inv').globalFilter).toBe('bob');
  });
});

describe('tableStateToSearch', () => {
  it('omits defaults (no params for an empty state)', () => {
    expect(tableStateToSearch({ sorting: [], globalFilter: '', pageIndex: 0 }, 'reg')).toEqual({
      regsort: undefined,
      regq: undefined,
      regpage: undefined,
    });
  });

  it('encodes sort direction and 1-based page under the prefix', () => {
    const state: DataTableState = {
      sorting: [{ id: 'balance', desc: false }],
      globalFilter: 'jo',
      pageIndex: 1,
    };
    expect(tableStateToSearch(state, 'cam')).toEqual({
      camsort: 'balance',
      camq: 'jo',
      campage: '2',
    });
  });

  it('round-trips through from→to', () => {
    const state: DataTableState = {
      sorting: [{ id: 'owed', desc: true }],
      globalFilter: 'x',
      pageIndex: 4,
    };
    const encoded = tableStateToSearch(state, 'reg');
    expect(tableStateFromSearch(encoded as Record<string, string>, 'reg')).toEqual(state);
  });
});

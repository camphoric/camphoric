import type { ApiReport } from 'api-types';
import { describe, expect, it } from 'vitest';

import { canonicalCategory, groupReports, reportCategories } from '../reportGroups';

let nextId = 1;
const report = (title: string, category = ''): ApiReport =>
  ({ id: nextId++, title, category, description: '' }) as ApiReport;

const listed = (reports: ApiReport[]) =>
  groupReports(reports).map((group) => [group.category, group.reports.map((r) => r.title)]);

describe('groupReports', () => {
  it('groups by category, alphabetically, with the uncategorised reports last', () => {
    expect(
      listed([
        report('Summary'),
        report('rooms', 'Rooming'),
        report('Payments', 'finance'),
        report('Arrivals'),
        report('balances', 'Finance '),
        report('Cabins', 'rooming'),
      ]),
    ).toEqual([
      // spelled as 'balances' (first by title) spells it, trimmed
      ['Finance', ['balances', 'Payments']],
      ['rooming', ['Cabins', 'rooms']],
      ['', ['Arrivals', 'Summary']],
    ]);
  });

  it('spells a category as the first of its reports by title does', () => {
    expect(listed([report('Zed', 'KITCHEN'), report('Alpha', 'Kitchen')])).toEqual([
      ['Kitchen', ['Alpha', 'Zed']],
    ]);
  });

  it('lists reports without any category as one group', () => {
    expect(listed([report('b'), report('A')])).toEqual([['', ['A', 'b']]]);
    expect(groupReports([])).toEqual([]);
  });
});

describe('reportCategories', () => {
  it('lists each category once, in order, without the empty one', () => {
    expect(
      reportCategories([
        report('a', 'Rooming'),
        report('b'),
        report('c', 'finance'),
        report('d', 'rooming'),
      ]),
    ).toEqual(['finance', 'Rooming']);
  });
});

describe('canonicalCategory', () => {
  it('trims, and spells an existing category its own way', () => {
    expect(canonicalCategory('  rooming ', ['Finance', 'Rooming'])).toBe('Rooming');
    expect(canonicalCategory(' Kitchen ', ['Finance'])).toBe('Kitchen');
    expect(canonicalCategory('   ', ['Finance'])).toBe('');
  });
});

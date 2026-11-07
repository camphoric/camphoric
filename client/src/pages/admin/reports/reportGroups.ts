/**
 * How an event's reports are listed (SPEC §8.7): grouped by category, the
 * categories in alphabetical order with the uncategorised reports after them,
 * and each group's reports by title. Both ignore case, and a category is the
 * same one however it's capitalised or spaced.
 */

import type { ApiReport } from 'api-types';

export interface ReportGroup {
  /** The category, as the first of its reports spells it; '' for none. */
  category: string;
  reports: ApiReport[];
}

// Ignoring case, as the reports API orders them (no numeric collation, which it lacks).
const byText = new Intl.Collator(undefined, { sensitivity: 'base' }).compare;

const categoryKey = (category: string) => category.trim().toLocaleLowerCase();

/** The event's reports by category, then title. */
export function groupReports(reports: readonly ApiReport[]): ReportGroup[] {
  const groups = new Map<string, ReportGroup>();
  const sorted = [...reports].sort((a, b) => byText(a.title, b.title) || a.id - b.id);
  for (const report of sorted) {
    const key = categoryKey(report.category);
    const group = groups.get(key);
    if (group) group.reports.push(report);
    else groups.set(key, { category: report.category.trim(), reports: [report] });
  }
  return [...groups.values()].sort((a, b) => {
    if (!a.category || !b.category) return a.category ? -1 : b.category ? 1 : 0;
    return byText(a.category, b.category);
  });
}

/**
 * The category to save for what was typed: trimmed, and spelled as an
 * existing one when it's that one in other capitals, so a report joins its
 * group rather than starting a near-duplicate.
 */
export function canonicalCategory(typed: string, existing: readonly string[]): string {
  const trimmed = typed.trim();
  const key = categoryKey(trimmed);
  return existing.find((category) => categoryKey(category) === key) ?? trimmed;
}

/**
 * The category to save when `typed` replaces a report's `current` one: left
 * as it was when unchanged; as typed when only its capitals or spaces changed,
 * so a category can be respelt (even one other reports share); otherwise as
 * `canonicalCategory` gives it.
 */
export function categoryToSave(
  typed: string,
  current: string,
  existing: readonly string[],
): string {
  const trimmed = typed.trim();
  if (trimmed === current.trim()) return current;
  if (categoryKey(trimmed) === categoryKey(current)) return trimmed;
  return canonicalCategory(trimmed, existing);
}

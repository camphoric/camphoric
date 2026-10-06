/**
 * Pure helpers for the lodging assignment timeline (SPEC §8.6). Stays are sets
 * of ISO day strings; the timeline lays them out as bars across the event's day
 * columns.
 */

import type { AugmentedLodging, Scalar } from 'api-types';
import { DateTime } from 'luxon';
import { listLodgingTree } from 'store/augmented';

/**
 * An event day for display in local time, e.g. "Fri 10/16". A date-only value
 * reads as local midnight of that same calendar day, so the label can't shift.
 */
export function dayLabel(iso: string, format = 'EEE MM/dd'): string {
  const dt = DateTime.fromISO(iso);
  return dt.isValid ? dt.toFormat(format) : iso;
}

/** Whether sorted date-only days follow one another with no gaps. */
export function areConsecutiveDays(days: string[]): boolean {
  return days.every(
    (day, index) =>
      index === 0 ||
      DateTime.fromISO(day).diff(DateTime.fromISO(days[index - 1]), 'days').days === 1,
  );
}

/** The day-column indices a stay occupies, sorted ascending. */
export function stayDayIndices(stay: string[] | null | undefined, days: string[]): number[] {
  if (!stay) return [];
  return stay
    .map((d) => days.indexOf(d))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
}

/** The contiguous span [start..end] a stay occupies, or null when empty. */
export function staySpan(
  stay: string[] | null | undefined,
  days: string[],
): { start: number; end: number } | null {
  const indices = stayDayIndices(stay, days);
  if (indices.length === 0) return null;
  return { start: indices[0], end: indices[indices.length - 1] };
}

/**
 * The days a camper can be present: every event day but the last. The last day
 * is departure day — campers leave by midday and no one stays over — so a stay
 * never includes it. A one-day event keeps its only day, so a camper can still
 * be placed.
 */
export function stayableDays(days: string[]): string[] {
  return days.length > 1 ? days.slice(0, -1) : days;
}

/**
 * A saved stay as it can be chosen: in day order, without departure day or
 * days outside the event. A stay saved before departure day was kept out of
 * stays loses it when next edited.
 */
export function stayWithinStayableDays(
  stay: string[] | null | undefined,
  days: string[],
): string[] {
  return stayableDays(days).filter((day) => stay?.includes(day));
}

/**
 * How many day-widths the timeline spans. Every day is a full column except
 * departure day, which is only its morning: campers leave by midday, so no bar
 * reaches past that. A one-day event's only day is also a stay, so it gets the
 * full day plus the half-day after it, when that stay ends.
 */
export function timelineDayUnits(dayCount: number): number {
  return dayCount > 1 ? dayCount - 0.5 : dayCount + 0.5;
}

/**
 * A stay of `length` days starting at `startIndex`, clamped to the event's days.
 * `startIndex` is itself clamped so at least one day remains.
 */
export function stayFrom(days: string[], startIndex: number, length: number): string[] {
  const max = Math.max(0, days.length - 1);
  const start = Math.min(Math.max(0, startIndex), max);
  const len = Math.max(1, length);
  return days.slice(start, start + len);
}

/**
 * The nodes the timeline can be narrowed to: every node under the root, leaves
 * included (a top-level unit with no sub-units, such as an "Off Site", is a
 * leaf), in tree order so each area's units follow it.
 */
export function lodgingFilterNodes(tree: AugmentedLodging | undefined): AugmentedLodging[] {
  return listLodgingTree(tree).slice(1);
}

/**
 * The leaves under any of the chosen nodes (a chosen leaf is its own subtree),
 * in their original order. Choosing nothing shows every leaf.
 */
export function leavesUnder(
  leaves: AugmentedLodging[],
  chosen: AugmentedLodging[],
): AugmentedLodging[] {
  if (chosen.length === 0) return leaves;
  const shown = new Set<number>();
  const visit = (node: AugmentedLodging) => {
    shown.add(node.id);
    node.children.forEach(visit);
  };
  chosen.forEach(visit);
  return leaves.filter((leaf) => shown.has(leaf.id));
}

/**
 * The capacity set on the node itself, as its form edits it. The tree's
 * `capacity` is the effective one — a node set to 0 takes its children's sum —
 * and `maxCapacity` is the node's own plus its children's, so the difference
 * recovers what was set.
 */
export function ownCapacity(node: AugmentedLodging): number {
  return node.maxCapacity - node.children.reduce((sum, child) => sum + child.capacity, 0);
}

/** "3 days: Fri 10/16 – Sun 10/18", or the days listed when they aren't consecutive. */
export function stayText(stay: string[]): string {
  if (stay.length === 0) return 'No days set';
  const count = `${stay.length} ${stay.length === 1 ? 'day' : 'days'}`;
  if (stay.length === 1) return `${count}: ${dayLabel(stay[0])}`;
  return areConsecutiveDays(stay)
    ? `${count}: ${dayLabel(stay[0])} – ${dayLabel(stay[stay.length - 1])}`
    : `${count}: ${stay.map((day) => dayLabel(day)).join(', ')}`;
}

/** A path for display, e.g. "Camp 1 → Cabin". */
export function lodgingPathLabel(pathParts: string[]): string {
  return pathParts.join(' → ');
}

export interface LeafSection {
  /** The parent's path, or "Top level" for units directly under the root. */
  heading: string;
  /** The parent node the units share. */
  parentId: Scalar | null;
  leaves: AugmentedLodging[];
}

/** Natural name order, so "Cabin 2" comes before "Cabin 10". */
export const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare;

/**
 * Group leaves by parent, so each section of the timeline can be headed by
 * where it is (a unit's own name, "Cabin 05", doesn't say which camp it's in).
 * Sections are sorted by heading ("Camp 1 → Cabin" before "Camp 1 → Tent →
 * Area A"), and the units within a section by name.
 */
export function leafSections(leaves: AugmentedLodging[]): LeafSection[] {
  const byParent = new Map<unknown, LeafSection>();
  for (const leaf of leaves) {
    const section = byParent.get(leaf.parent);
    if (section) {
      section.leaves.push(leaf);
    } else {
      const parentPath = leaf.pathParts.slice(0, -1);
      byParent.set(leaf.parent, {
        heading: parentPath.length ? lodgingPathLabel(parentPath) : 'Top level',
        parentId: leaf.parent ?? null,
        leaves: [leaf],
      });
    }
  }
  return [...byParent.values()]
    .sort((a, b) => byName(a.heading, b.heading))
    .map((section) => ({
      ...section,
      leaves: [...section.leaves].sort((a, b) => byName(a.name, b.name)),
    }));
}

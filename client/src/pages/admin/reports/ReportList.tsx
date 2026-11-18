/**
 * The Reports page's list of reports (SPEC §8.7): grouped by category, each
 * category under a heading that collapses and expands it and shows how many
 * reports it holds, with the reports indented under it. While no report has a
 * category the list is one group with no heading. The selected report's
 * category opens whenever the selection lands in it: when a report is opened
 * from the URL, chosen, added, or moved to another category.
 */

import { Badge, Group, NavLink, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import type { ApiReport } from 'api-types';
import { type ReactNode, useId, useState } from 'react';

import { categoryKey, type ReportGroup } from './reportGroups';

export interface ReportListProps {
  /** The event's reports, as `groupReports` groups them. */
  groups: readonly ReportGroup[];
  /** The report shown as selected, if any. */
  selectedId?: number;
  onSelect: (report: ApiReport) => void;
  /** Shown at the end of a report's row (e.g. who is editing it). */
  renderMarker?: (report: ApiReport) => ReactNode;
}

const UNCATEGORISED = 'Uncategorised';

const reportCount = (count: number) => `${count} ${count === 1 ? 'report' : 'reports'}`;

export function ReportList({ groups, selectedId, onSelect, renderMarker }: ReportListProps) {
  const hasHeadings = groups.some((group) => group.category);
  const [collapsedKeys, setCollapsedKeys] = useState<ReadonlySet<string>>(new Set());

  // Where the selection is: the selected report and the category it's in now,
  // so choosing another report, or moving this one, opens its category again.
  const selectedGroup = groups.find((group) => group.reports.some((r) => r.id === selectedId));
  const selectedKey = selectedGroup && categoryKey(selectedGroup.category);
  const selection = selectedKey === undefined ? undefined : `${selectedId}:${selectedKey}`;
  const [openedFor, setOpenedFor] = useState(selection);
  if (selection !== openedFor) {
    setOpenedFor(selection);
    if (selectedKey !== undefined) setCollapsedKeys((keys) => without(keys, selectedKey));
  }

  const toggle = (key: string) =>
    setCollapsedKeys((keys) => (keys.has(key) ? without(keys, key) : new Set(keys).add(key)));

  if (!groups.length) {
    return (
      <Text c="dimmed" size="sm">
        No reports yet.
      </Text>
    );
  }

  return (
    <Stack gap="md">
      {groups.map((group) => {
        const key = categoryKey(group.category);
        return (
          <ReportGroupSection
            key={key}
            group={group}
            hasHeading={hasHeadings}
            isExpanded={!hasHeadings || !collapsedKeys.has(key)}
            onToggle={() => toggle(key)}
            selectedId={selectedId}
            onSelect={onSelect}
            renderMarker={renderMarker}
          />
        );
      })}
    </Stack>
  );
}

interface ReportGroupSectionProps extends Omit<ReportListProps, 'groups'> {
  group: ReportGroup;
  hasHeading: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function ReportGroupSection({
  group,
  hasHeading,
  isExpanded,
  onToggle,
  selectedId,
  onSelect,
  renderMarker,
}: ReportGroupSectionProps) {
  const listId = useId();
  const name = group.category || UNCATEGORISED;
  const count = group.reports.length;
  const Chevron = isExpanded ? IconChevronDown : IconChevronRight;

  return (
    <Stack gap={2} role="group" aria-label={name}>
      {hasHeading && (
        <UnstyledButton
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? listId : undefined}
          aria-label={`${name}, ${reportCount(count)}`}
          px="sm"
          py={4}
        >
          <Group gap={6} wrap="nowrap" justify="space-between">
            <Group gap={4} wrap="nowrap">
              <Chevron size={14} aria-hidden style={{ flexShrink: 0 }} />
              <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                {name}
              </Text>
            </Group>
            <Badge size="sm" variant="light" color="gray" circle={count < 10}>
              {count}
            </Badge>
          </Group>
        </UnstyledButton>
      )}
      {isExpanded && (
        // Indented under its heading, so it's clear which category a report is in.
        <Stack id={listId} gap={2} pl={hasHeading ? 'xl' : 0}>
          {group.reports.map((report) => (
            <NavLink
              key={report.id}
              component="button"
              type="button"
              label={report.title}
              description={report.description || undefined}
              active={report.id === selectedId}
              variant="light"
              onClick={() => onSelect(report)}
              rightSection={renderMarker?.(report)}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function without(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  if (!keys.has(key)) return keys;
  const next = new Set(keys);
  next.delete(key);
  return next;
}

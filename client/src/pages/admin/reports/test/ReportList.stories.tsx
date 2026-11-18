/**
 * Stories for the Reports page's report list (SPEC §8.7): categories that
 * collapse and expand, with their reports indented under them; some collapsed;
 * no categories at all (one group, no headings); and no reports. Choosing a
 * report selects it. Run `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn, StoryObj } from '@storybook/react-vite';
import type { ApiReport } from 'api-types';
import { useMemo, useState } from 'react';
import { userEvent, within } from 'storybook/test';

import { groupReports } from '../reportGroups';
import { ReportList } from '../ReportList';

const report = (id: number, title: string, category = '', description = ''): ApiReport =>
  ({ id, event: 1, title, category, description, version: 1 }) as ApiReport;

const CATEGORISED = [
  report(1, 'Payments', 'Finance', 'Every payment, by date'),
  report(2, 'Balances due', 'Finance'),
  report(3, 'Refunds', 'Finance'),
  report(4, 'Cabin assignments', 'Rooming', 'Who sleeps where'),
  report(5, 'Roommate requests', 'Rooming'),
  report(6, 'Dietary needs', 'Kitchen'),
  report(7, 'Summary'),
  report(8, 'Mailing list'),
];

const UNCATEGORISED = [report(1, 'Summary'), report(2, 'Mailing list'), report(3, 'Payments')];

/** The list in a sidebar-wide box, selecting the report that's chosen. */
function List({ reports, selected }: { reports: ApiReport[]; selected?: number }) {
  const groups = useMemo(() => groupReports(reports), [reports]);
  const [selectedId, setSelectedId] = useState(selected);
  return (
    <Box maw={300} p="md">
      <ReportList
        groups={groups}
        selectedId={selectedId}
        onSelect={(chosen) => setSelectedId(chosen.id)}
      />
    </Box>
  );
}

export default { title: 'Report List' } satisfies Meta;

export const Categorised: StoryFn = () => <List reports={CATEGORISED} selected={1} />;

/** Rooming and Uncategorised collapsed; Finance holds the selected report. */
export const SomeCollapsed: StoryObj = {
  render: () => <List reports={CATEGORISED} selected={1} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^Rooming,/ }));
    await userEvent.click(canvas.getByRole('button', { name: /^Uncategorised,/ }));
  },
};

export const NoCategories: StoryFn = () => <List reports={UNCATEGORISED} selected={2} />;

export const NoReports: StoryFn = () => <List reports={[]} />;

/**
 * Story for the CsvTable (SPEC §8.7, §9.6): report output and template
 * previews as a table. Run `npm run storybook`.
 */

import { Box, Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { CsvTable } from '../CsvTable';

export default { title: 'CSV Table' } satisfies Meta;

export const Basic: StoryFn = () => (
  <Stack maw={720} p="md">
    <CsvTable
      csv={
        'Name,Lodging,Balance\nPat,Cabins→Cabin A,$725.00\nSam,Cabins→Cabin A,\n"Lee, Jr.",Tents→Tent 1,-$50.50\n'
      }
    />
  </Stack>
);

/** As a report shows it: in its own scrolling box, the header row staying in view. */
export const WideAndLongScrolling: StoryFn = () => {
  const header = Array.from({ length: 16 }, (_, i) => `Column ${i + 1}`).join(',');
  const rows = Array.from({ length: 60 }, (_, r) =>
    Array.from({ length: 16 }, (_, c) => `Row ${r + 1} value ${c + 1}`).join(','),
  );
  return (
    <Box maw={720} m="md" mah={360} style={{ overflow: 'auto' }}>
      <CsvTable csv={[header, ...rows].join('\n')} stickyHeader />
    </Box>
  );
};

export const HeaderOnly: StoryFn = () => (
  <Stack maw={720} p="md">
    <CsvTable csv="Name,Lodging" />
  </Stack>
);

/**
 * Story for the CsvTable (SPEC §8.7, §9.6): report output and template
 * previews as a table. Run `npm run storybook`.
 */

import { Stack } from '@mantine/core';
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

export const HeaderOnly: StoryFn = () => (
  <Stack maw={720} p="md">
    <CsvTable csv="Name,Lodging" />
  </Stack>
);

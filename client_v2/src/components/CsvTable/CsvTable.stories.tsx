/**
 * Ladle story for the CsvTable (SPEC §8.7, §9.6): report output and template
 * previews as a table. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Stack } from '@mantine/core';

import { CsvTable } from './CsvTable';

export const Basic: Story = () => (
  <Stack maw={720} p="md">
    <CsvTable
      csv={
        'Name,Lodging,Balance\nPat,Cabins→Cabin A,$725.00\nSam,Cabins→Cabin A,\n"Lee, Jr.",Tents→Tent 1,-$50.50\n'
      }
    />
  </Stack>
);

export const HeaderOnly: Story = () => (
  <Stack maw={720} p="md">
    <CsvTable csv="Name,Lodging" />
  </Stack>
);

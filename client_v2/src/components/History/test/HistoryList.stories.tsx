/**
 * Stories for a registration's change history (SPEC §8.4; §15, DR-53):
 * edits grouped with the pricing they recalculated, a camper deleted and
 * restored, a payment changed, and the online registration that started it;
 * a long JSON change shown as a diff; and a long value cut short. Run `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import type { ApiHistoryEntry } from 'api-types';

import { HistoryList } from '../HistoryList';
import { ENTRIES, LOOKUPS, TITLES } from './entries';

export default { title: 'History List' } satisfies Meta;

export const Registration: StoryFn = () => (
  <Box p="md" maw={720}>
    <HistoryList entries={ENTRIES} options={{ titles: TITLES, lookups: LOOKUPS }} />
  </Box>
);

export const Empty: StoryFn = () => (
  <Box p="md" maw={720}>
    <HistoryList entries={[]} />
  </Box>
);

const pricingLogic = (rate: number) => [
  {
    var: 'tuition',
    label: 'Tuition, half price for children under 13',
    exp: { if: [{ '<': [{ var: 'camper.age' }, 13] }, rate / 2, rate] },
  },
  { var: 'linens', label: 'Linens', exp: { if: [{ var: 'camper.linens' }, 25, 0] } },
  { var: 'total', label: 'Total', exp: { '+': [{ var: 'tuition' }, { var: 'linens' }] } },
];

const eventChange = (changes: ApiHistoryEntry['changes']): ApiHistoryEntry => ({
  ...ENTRIES[0],
  action: 'update',
  object: { type: 'event', id: 7, label: 'Lark Camp 2026' },
  changes,
});

/** A change to long JSON: just the lines that changed, red and green. */
export const JsonDiff: StoryFn = () => (
  <Box p="md" maw={720}>
    <HistoryList
      entries={[eventChange({ camper_pricing_logic: [pricingLogic(450), pricingLogic(475)] })]}
      options={{ nameEveryObject: true }}
    />
  </Box>
);

/** A long one-line value: cut short, with Show all. */
export const LongValue: StoryFn = () => (
  <Box p="md" maw={720}>
    <HistoryList
      entries={[
        eventChange({
          name: [
            'Lark Camp 2026',
            'Lark Camp 2026 — a week of music and dance in the redwoods of Mendocino, ' +
              'with workshops, jams and dances every night from Friday through Saturday',
          ],
        }),
      ]}
      options={{ nameEveryObject: true }}
    />
  </Box>
);

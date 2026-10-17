/**
 * Stories for RenderedMarkdown — markdown the pipeline has rendered, whose
 * tables each sit in a box of their own. A box narrower than its table scrolls
 * sideways and takes keyboard focus; one its table fits takes none. Run
 * `npm run storybook`.
 */

import { Stack, Text } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { markdownToHtml, RenderedMarkdown } from 'components/templating';

const rates = markdownToHtml(
  [
    'Camper rates:',
    '',
    '| Lodging | Adult | Teen (13-17) | Youth (5-12) | Child (2-4) | Infant (0-1) |',
    '| ------- | ----- | ------------ | ------------ | ----------- | ------------ |',
    '| Cabin with bath | $1,250 | $1,050 | $850 | $450 | free |',
    '| Tent or RV | $900 | $800 | $650 | $350 | free |',
  ].join('\n'),
);

export default { title: 'Rendered Markdown' } satisfies Meta;

/** The table fits its column: no scrolling, no tab stop. */
export const TableFits: StoryFn = () => (
  <Stack p="md" maw={900}>
    <RenderedMarkdown html={rates} />
  </Stack>
);

/** A column narrower than the table, as on a phone: the box scrolls, and Tab reaches it. */
export const TableScrolls: StoryFn = () => (
  <Stack p="md" maw={320}>
    <Text size="sm">Tab to the table, then scroll it with the arrow keys.</Text>
    <RenderedMarkdown html={rates} />
  </Stack>
);

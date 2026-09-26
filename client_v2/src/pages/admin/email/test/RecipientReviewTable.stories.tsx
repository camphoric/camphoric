/**
 * Ladle stories for reviewing who a group email goes to (SPEC §8.9): the
 * recipients with checkboxes and search; one already got it (skipped, or not).
 * Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Stack, Switch, Text } from '@mantine/core';
import { useState } from 'react';

import { RecipientReviewTable } from '../RecipientReviewTable';
import { sampleAudience } from './emailFixtures';

const { recipients } = sampleAudience();

export const Review: Story = () => {
  const [selected, setSelected] = useState(() => new Set(recipients.map((r) => r.key)));
  const [skip, setSkip] = useState(true);
  return (
    <Stack p="md" maw={900}>
      <Switch
        label="Skip those who already got it"
        checked={skip}
        onChange={(e) => setSkip(e.currentTarget.checked)}
      />
      <RecipientReviewTable
        recipients={recipients}
        selected={selected}
        onSelectedChange={setSelected}
        skipAlreadySent={skip}
      />
      <Text size="sm" data-testid="selected">
        Selected: {[...selected].join(', ') || 'none'}
      </Text>
    </Stack>
  );
};

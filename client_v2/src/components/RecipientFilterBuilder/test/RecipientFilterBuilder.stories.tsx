/**
 * Ladle stories for the recipient filter builder (SPEC §8.9): no conditions,
 * a filter using every kind of field, and a rule on a field the event no longer
 * has. The JSON the builder produces is shown under it. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Code, Stack } from '@mantine/core';
import type { EmailFilter } from 'api-types';
import { useState } from 'react';

import { EMPTY_FILTER, RecipientFilterBuilder } from '../RecipientFilterBuilder';
import { recipientFields } from './recipientFields';

function Harness({ initial }: { initial: EmailFilter }) {
  const [filter, setFilter] = useState(initial);
  return (
    <Stack maw={820}>
      <RecipientFilterBuilder
        value={filter}
        onChange={setFilter}
        fields={recipientFields}
        everyone="camper"
      />
      <Code block data-testid="filter-json">
        {JSON.stringify(filter, null, 2)}
      </Code>
    </Stack>
  );
}

export const Empty: Story = () => <Harness initial={EMPTY_FILTER} />;

export const EveryType: Story = () => (
  <Harness
    initial={{
      combinator: 'and',
      rules: [
        { field: 'registration.balance', op: 'gt', value: 0 },
        { field: 'camper.attributes.meals', op: 'any_of', value: ['Vegetarian', 'Vegan'] },
        { field: 'camper.attributes.instruments', op: 'contains', value: 'Fiddle' },
        { field: 'registration.created_at', op: 'after', value: '2026-05-01' },
        { field: 'registration.completed', op: 'is_true', value: null },
        { field: 'camper.lodging.name', op: 'is_set', value: null },
        { field: 'registration.registrant_email', op: 'contains', value: '@example.org' },
      ],
    }}
  />
);

export const MissingField: Story = () => (
  <Harness
    initial={{
      combinator: 'or',
      rules: [{ field: 'camper.attributes.shirt_size', op: 'is', value: 'L' }],
    }}
  />
);

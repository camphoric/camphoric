/**
 * How many "needs attention" items there are of each kind, at a glance (SPEC
 * §8.11; §15, DR-171): on the Payments area, and on the event's Home. Kinds
 * with none are left out; with nothing at all it says so.
 */

import { Badge, Group, Text } from '@mantine/core';
import type { ApiPaymentsAttentionItem } from 'api-types';

import { ATTENTION_COLOR, ATTENTION_KINDS, ATTENTION_LABEL, countByKind } from './attention';

export function AttentionCounts({ items }: { items: readonly ApiPaymentsAttentionItem[] }) {
  const counts = countByKind(items);
  const shown = ATTENTION_KINDS.filter((kind) => counts[kind] > 0);
  if (shown.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Nothing needs attention.
      </Text>
    );
  }
  return (
    <Group gap="xs" aria-label="Needs attention, by kind">
      {shown.map((kind) => (
        <Badge key={kind} color={ATTENTION_COLOR[kind]} variant="light" size="lg">
          {ATTENTION_LABEL[kind]}: {counts[kind]}
        </Badge>
      ))}
    </Group>
  );
}

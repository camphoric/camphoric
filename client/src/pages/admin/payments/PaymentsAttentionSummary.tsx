/**
 * The event's "needs attention" counts, on its Home (SPEC §8.3, §8.11; §15,
 * DR-171), with the way to the Payments area that lists them.
 */

import { Anchor, Group, Text } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { usePaymentsAttention } from 'store/paymentsAttention';

import { AttentionCounts } from './AttentionCounts';

export function PaymentsAttentionSummary({
  organizationId,
  eventId,
}: {
  organizationId: string;
  eventId: string;
}) {
  const { data: items } = usePaymentsAttention(eventId);
  if (!items) return null;
  return (
    <Group gap="sm" wrap="wrap" aria-label="Payments needing attention">
      <Text fw={500}>Payments:</Text>
      <AttentionCounts items={items} />
      {items.length > 0 && (
        <Anchor
          component={Link}
          to={`/admin/organization/${organizationId}/event/${eventId}/payments`}
          size="sm"
        >
          See what needs doing
        </Anchor>
      )}
    </Group>
  );
}

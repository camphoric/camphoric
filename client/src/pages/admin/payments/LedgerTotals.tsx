/**
 * The totals of a ledger's rows shown (SPEC §8.11): for reconciling a date
 * range or a payment type against the bank, PayPal or a deposit.
 */

import { Group, Stack, Text } from '@mantine/core';
import { formatMoney } from 'utils/money';

export interface LedgerTotal {
  label: string;
  amount: number;
}

export function LedgerTotals({ count, totals }: { count: number; totals: LedgerTotal[] }) {
  return (
    <Group mt="sm" gap="xl" aria-label="Totals of the rows shown" wrap="wrap">
      <Stack gap={0}>
        <Text size="xs" c="dimmed">
          Rows
        </Text>
        <Text fw={600}>{count}</Text>
      </Stack>
      {totals.map(({ label, amount }) => (
        <Stack key={label} gap={0}>
          <Text size="xs" c="dimmed">
            {label}
          </Text>
          <Text fw={600}>{formatMoney(amount)}</Text>
        </Stack>
      ))}
    </Group>
  );
}

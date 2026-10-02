/**
 * A registration's ledger (SPEC §9.7): its price, the handling fees on its
 * invoices, what it owes in all, what's been paid (less refunds), and the
 * balance — negative when a refund is due. Also what no open invoice asks for
 * yet.
 */

import { Group, Stack, Text } from '@mantine/core';
import type { ApiRegistration } from 'api-types';
import { formatMoney } from 'utils/money';

export type Ledger = Pick<
  ApiRegistration,
  'total_owed' | 'total_paid' | 'balance' | 'handling_charges' | 'uninvoiced_balance'
>;

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Text fw={strong ? 600 : undefined}>{label}</Text>
      <Text fw={strong ? 600 : undefined}>{formatMoney(value)}</Text>
    </Group>
  );
}

export function LedgerSummary({ ledger }: { ledger: Ledger }) {
  const price = ledger.total_owed - ledger.handling_charges;
  return (
    <Stack gap={2} maw={360} aria-label="Ledger">
      {ledger.handling_charges !== 0 && (
        <>
          <Row label="Price" value={price} />
          <Row label="Electronic payment handling" value={ledger.handling_charges} />
        </>
      )}
      <Row label="Total owed" value={ledger.total_owed} strong />
      <Row label="Total paid" value={ledger.total_paid} />
      {ledger.balance < 0 ? (
        <Row label="Refund due" value={-ledger.balance} strong />
      ) : (
        <Row label="Balance due" value={ledger.balance} strong />
      )}
      {ledger.uninvoiced_balance > 0 && (
        <Text size="sm" c="dimmed">
          {formatMoney(ledger.uninvoiced_balance)} of the balance isn’t on an invoice yet.
        </Text>
      )}
    </Stack>
  );
}

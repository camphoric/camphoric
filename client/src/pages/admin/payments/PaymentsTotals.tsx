/**
 * The event's money in totals (SPEC §8.11; §15, DR-173), as the server works
 * it out from every live registration: what's owed and received, the price
 * line by line, custom charges (cancellation fees among them) and payments by
 * type, and the handling fees charged beside what PayPal kept. Read-only, for
 * every role.
 */

import { Badge, Group, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import type { ApiPaymentsTotals } from 'api-types';
import { type ReactNode, useId } from 'react';
import { formatMoney } from 'utils/money';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <Stack component="section" aria-labelledby={id} gap="xs">
      <Title order={4} id={id}>
        {title}
      </Title>
      {children}
    </Stack>
  );
}

interface Row {
  label: ReactNode;
  amount: string;
  /** A total: shown bold, with a rule above. */
  total?: boolean;
  /** Part of the row above it: indented. */
  part?: boolean;
}

/** Label and amount rows, the amounts lined up on the right. */
function AmountRows({ rows }: { rows: Row[] }) {
  return (
    <Table maw={480} verticalSpacing={4} withRowBorders={false}>
      <Table.Tbody>
        {rows.map((row, index) => (
          <Table.Tr
            key={index}
            fw={row.total ? 600 : undefined}
            style={
              row.total ? { borderTop: '1px solid var(--mantine-color-default-border)' } : undefined
            }
          >
            <Table.Td pl={row.part ? 'lg' : undefined} c={row.part ? 'dimmed' : undefined}>
              {row.label}
            </Table.Td>
            <Table.Td ta="right" c={row.part ? 'dimmed' : undefined}>
              {formatMoney(row.amount)}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

const isZero = (amount: string) => Number(amount) === 0;

function Summary({ totals }: { totals: ApiPaymentsTotals }) {
  const { summary, registrations } = totals;
  return (
    <Section title="Owed and received">
      <AmountRows
        rows={[
          {
            label: `Priced (${registrations} registration${registrations === 1 ? '' : 's'})`,
            amount: summary.price,
          },
          { label: 'Handling fees charged', amount: summary.handling },
          { label: 'Owed', amount: summary.owed, total: true },
          { label: 'Received (payments less refunds)', amount: summary.received },
          { label: 'Balance', amount: summary.balance, total: true },
          { label: 'Still owed', amount: summary.still_owed, part: true },
          { label: 'of which no invoice asks for yet', amount: summary.not_invoiced, part: true },
          { label: 'Refunds due', amount: summary.refunds_due, part: true },
        ]}
      />
    </Section>
  );
}

const LEVEL_LABEL = { registration: 'Registration', camper: 'Campers', built_in: null } as const;

function Charges({ totals }: { totals: ApiPaymentsTotals }) {
  const { charges } = totals;
  const rows: Row[] = charges.lines.map((line) => ({
    label: (
      <Group gap="xs" wrap="nowrap">
        <span>{line.label}</span>
        {LEVEL_LABEL[line.level] && (
          <Text span size="xs" c="dimmed">
            {LEVEL_LABEL[line.level]}
          </Text>
        )}
        {line.credit && (
          <Badge size="xs" variant="light" color="teal">
            Credit
          </Badge>
        )}
      </Group>
    ),
    amount: line.amount,
  }));
  if (!isZero(charges.other)) {
    rows.push({ label: 'Other, not in a line', amount: charges.other });
  }
  rows.push({ label: 'Priced', amount: charges.total, total: true });
  return (
    <Section title="Charges">
      <Text size="sm" c="dimmed">
        Each price line, as the event’s pricing adds it up, over every registration as it’s priced
        now.
      </Text>
      <AmountRows rows={rows} />
    </Section>
  );
}

function ChargeTypes({ totals }: { totals: ApiPaymentsTotals }) {
  const { charge_types: types, cancellation_fees: fees } = totals;
  const group = (own: boolean) => types.filter((type) => type.registration_own === own);
  const groups = [
    { title: 'On campers', types: group(false) },
    { title: 'On registrations', types: group(true) },
  ].filter((g) => g.types.length > 0);
  return (
    <Section title="Custom charges by type">
      <Text size="sm">
        Cancellation fees kept: {fees.count} — {formatMoney(fees.amount)}
      </Text>
      {groups.length === 0 ? (
        <Text size="sm" c="dimmed">
          No custom charges.
        </Text>
      ) : (
        <Table maw={480} verticalSpacing={4}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th ta="right">Charges</Table.Th>
              <Table.Th ta="right">Amount</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {groups.map((g) => [
              <Table.Tr key={g.title}>
                <Table.Td colSpan={3} fw={600}>
                  {g.title}
                </Table.Td>
              </Table.Tr>,
              // Two types may share a name and label, so a row is keyed by its place.
              ...g.types.map((type, index) => (
                <Table.Tr key={`${g.title}-${index}`}>
                  <Table.Td pl="lg">{type.label}</Table.Td>
                  <Table.Td ta="right">{type.count}</Table.Td>
                  <Table.Td ta="right">{formatMoney(type.amount)}</Table.Td>
                </Table.Tr>
              )),
            ])}
          </Table.Tbody>
        </Table>
      )}
    </Section>
  );
}

function PaymentTypes({ totals }: { totals: ApiPaymentsTotals }) {
  const types = totals.payment_types;
  const sum = (pick: (row: (typeof types)[number]) => string | number) =>
    types.reduce((total, row) => total + Number(pick(row)), 0);
  return (
    <Section title="Payments by type">
      {types.length === 0 ? (
        <Text size="sm" c="dimmed">
          No payments yet.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={560}>
          <Table verticalSpacing={4} maw={800} style={{ whiteSpace: 'nowrap' }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Type</Table.Th>
                <Table.Th ta="right">Payments</Table.Th>
                <Table.Th ta="right">Received</Table.Th>
                <Table.Th ta="right">Refunds</Table.Th>
                <Table.Th ta="right">Refunded</Table.Th>
                <Table.Th ta="right">Net</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {types.map((row) => (
                <Table.Tr key={row.type}>
                  <Table.Td>{row.label}</Table.Td>
                  <Table.Td ta="right">{row.payments}</Table.Td>
                  <Table.Td ta="right">{formatMoney(row.received)}</Table.Td>
                  <Table.Td ta="right">{row.refunds}</Table.Td>
                  <Table.Td ta="right">{formatMoney(row.refunded)}</Table.Td>
                  <Table.Td ta="right">{formatMoney(row.net)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
            <Table.Tfoot>
              <Table.Tr fw={600}>
                <Table.Td>All types</Table.Td>
                <Table.Td ta="right">{sum((row) => row.payments)}</Table.Td>
                <Table.Td ta="right">{formatMoney(sum((row) => row.received))}</Table.Td>
                <Table.Td ta="right">{sum((row) => row.refunds)}</Table.Td>
                <Table.Td ta="right">{formatMoney(sum((row) => row.refunded))}</Table.Td>
                <Table.Td ta="right">{formatMoney(sum((row) => row.net))}</Table.Td>
              </Table.Tr>
            </Table.Tfoot>
          </Table>
        </Table.ScrollContainer>
      )}
    </Section>
  );
}

function OnlineFees({ totals }: { totals: ApiPaymentsTotals }) {
  const fees = totals.online_fees;
  return (
    <Section title="Online payment fees">
      <Text size="sm" c="dimmed">
        The handling fees charged on invoices, beside what PayPal kept as its own fees on the
        payments it took (it keeps them when a payment is refunded).
      </Text>
      <AmountRows
        rows={[
          { label: 'Handling fees charged', amount: fees.handling },
          { label: 'PayPal’s fees', amount: fees.paypal_fees },
          { label: 'Handling less PayPal’s fees', amount: fees.difference, total: true },
        ]}
      />
    </Section>
  );
}

export function PaymentsTotals({ totals }: { totals: ApiPaymentsTotals }) {
  return (
    <Stack gap="xl">
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl" verticalSpacing="xl">
        <Summary totals={totals} />
        <Charges totals={totals} />
      </SimpleGrid>
      <PaymentTypes totals={totals} />
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl" verticalSpacing="xl">
        <ChargeTypes totals={totals} />
        <OnlineFees totals={totals} />
      </SimpleGrid>
    </Stack>
  );
}

/**
 * The registrant's payment options (SPEC §7.2, §9.7): the event's deposit
 * choices — "Full Payment", "50% Deposit" … — as the server worked them out
 * (#675). For the chosen option it shows what paying by check costs and what
 * paying online costs, which adds the handling fee on that amount (§15, DR-88).
 * Presentational: the container holds the choice.
 */

import { Radio, Stack, Table, Text, Title } from '@mantine/core';
import type { ApiPaymentOption, ApiPaymentOptions } from 'api-types';
import { Template } from 'components/templating';
import { formatMoney } from 'utils/money';

export interface PaymentOptionsProps {
  paymentOptions: ApiPaymentOptions;
  /** The chosen option's name. */
  selected: string;
  onSelect: (name: string) => void;
  /** Whether paying online is offered (to show its total). */
  online: boolean;
  /** The handling percent on online payments, if any. */
  handlingPercent: number | null;
  disabled?: boolean;
}

export function PaymentOptions({
  paymentOptions,
  selected,
  onSelect,
  online,
  handlingPercent,
  disabled,
}: PaymentOptionsProps) {
  const { options } = paymentOptions;
  const option: ApiPaymentOption | undefined =
    options.find((o) => o.name === selected) ?? options[0];

  return (
    <Stack gap="sm">
      {options.length > 1 && (
        <>
          {paymentOptions.title && <Title order={4}>{paymentOptions.title}</Title>}
          {paymentOptions.description && <Template markdown={paymentOptions.description} />}
          <Radio.Group
            value={option?.name}
            onChange={onSelect}
            name="payment-option"
            aria-label={paymentOptions.title || 'Payment option'}
          >
            <Stack gap="xs">
              {options.map((o) => (
                <Radio
                  key={o.name}
                  value={o.name}
                  disabled={disabled}
                  label={`${o.title}: ${formatMoney(o.amount)}`}
                />
              ))}
            </Stack>
          </Radio.Group>
        </>
      )}

      {option && (
        <Table withRowBorders={false} w="auto" aria-label="Amount due now">
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>By check</Table.Td>
              <Table.Td ta="right" fw={600}>
                {formatMoney(option.amount)}
              </Table.Td>
            </Table.Tr>
            {online && (
              <Table.Tr>
                <Table.Td>
                  Online
                  {option.handling > 0 && (
                    <Text span size="sm" c="dimmed">
                      {' '}
                      (includes {formatMoney(option.handling)} handling
                      {handlingPercent ? `, ${handlingPercent}%` : ''})
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="right" fw={600}>
                  {formatMoney(option.amount + option.handling)}
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

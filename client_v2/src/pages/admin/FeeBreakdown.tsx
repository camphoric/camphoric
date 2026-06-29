/**
 * Fee breakdown from a `server_pricing_results` object (SPEC §8.4, §8.5). Each
 * numeric line item is labeled from the pricing-logic vars (registration and/or
 * camper logic); `total` and `campers` are excluded (the caller shows the total
 * and the per-camper rows itself).
 */

import { Group, Stack, Text } from '@mantine/core';
import type { JsonLogicPricing, PricingResults } from 'api-types';
import { formatMoney } from 'utils/money';

/** Find a fee's label from the pricing-logic vars, falling back to the key. */
export function feeLabel(key: string, ...logics: JsonLogicPricing[]): string {
  for (const logic of logics) {
    const found = logic.find((component) => component.var === key);
    if (found?.label) return found.label;
  }
  return key;
}

interface FeeBreakdownProps {
  results: PricingResults;
  logics: JsonLogicPricing[];
}

export function FeeBreakdown({ results, logics }: FeeBreakdownProps) {
  const lineItems = Object.entries(results).filter(
    ([key, value]) => key !== 'total' && key !== 'campers' && typeof value === 'number',
  ) as [string, number][];

  if (lineItems.length === 0) return null;

  return (
    <Stack gap={2} maw={360}>
      {lineItems.map(([key, value]) => (
        <Group key={key} justify="space-between">
          <Text size="sm">{feeLabel(key, ...logics)}</Text>
          <Text size="sm">{formatMoney(value)}</Text>
        </Group>
      ))}
    </Stack>
  );
}

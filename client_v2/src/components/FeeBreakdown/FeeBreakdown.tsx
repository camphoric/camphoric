/**
 * Fee breakdown from a `server_pricing_results` object (SPEC §8.4, §8.5). Each
 * numeric line item is labeled from the pricing-logic vars (registration and/or
 * camper logic); `total` and `campers` are excluded (the caller shows the total
 * and the per-camper rows itself).
 *
 * With a registrar's overrides (SPEC §15, DR-56), an overridden line shows what
 * the pricing worked out, the reason and who set it. Lines in `overridable` get
 * Override / Change / Remove actions when the callbacks are given (leave them
 * out for someone who can't change pricing). An overridden line in
 * `recalculable` whose pricing now works out differently also gets Recalculate,
 * to set the override to that amount (§15, DR-78). An override that isn't in
 * effect (its line is gone, or there's no handling fee) is listed after the lines.
 */

import { Anchor, Button, Group, Stack, Text } from '@mantine/core';
import type { ApiPricingOverride, JsonLogicPricing, PricingResults } from 'api-types';
import { formatMoney } from 'utils/money';

/** The electronic-payment handling fee's line, added by the server after the rest. */
export const HANDLING = 'handling';
const HANDLING_LABEL = 'Electronic payment handling';
/** A promo code's discount line (§15, DR-67); labelled with the code's label where known. */
export const PROMO = 'promo';
export const PROMO_LABEL = 'Promo code';

/** Find a fee's label from the pricing-logic vars, falling back to the key. */
export function feeLabel(key: string, ...logics: JsonLogicPricing[]): string {
  for (const logic of logics) {
    const found = logic.find((component) => component.var === key);
    if (found?.label) return found.label;
  }
  if (key === HANDLING) return HANDLING_LABEL;
  return key === PROMO ? PROMO_LABEL : key;
}

/** A line of the breakdown, as the override actions see it. */
export interface FeeLine {
  key: string;
  label: string;
  value: number;
  /** What the pricing works out for it, before any override. */
  computed: number;
  override?: ApiPricingOverride;
}

interface FeeBreakdownProps {
  results: PricingResults;
  logics: JsonLogicPricing[];
  /** Labels the promo code's discount line: the code's own label. */
  promoLabel?: string;
  /** Overrides of these results' lines. */
  overrides?: ApiPricingOverride[];
  /** The lines that can be overridden here. */
  overridable?: string[];
  onOverride?: (line: FeeLine) => void;
  onRemoveOverride?: (override: ApiPricingOverride) => void;
  /** Overridden lines that can be set to what the pricing works out now. */
  recalculable?: string[];
  onRecalculate?: (line: FeeLine) => void;
}

export function FeeBreakdown({
  results,
  logics,
  promoLabel,
  overrides = [],
  overridable = [],
  onOverride,
  onRemoveOverride,
  recalculable = [],
  onRecalculate,
}: FeeBreakdownProps) {
  const lines: FeeLine[] = Object.entries(results)
    .filter(([key, value]) => key !== 'total' && key !== 'campers' && typeof value === 'number')
    .map(([key, value]) => ({
      key,
      label: key === PROMO && promoLabel ? promoLabel : feeLabel(key, ...logics),
      value: value as number,
      computed: results.overridden?.[key] ?? (value as number),
      override: overrides.find((o) => o.var === key && o.applied !== false),
    }));
  const notApplied = overrides.filter((o) => o.applied === false);

  if (lines.length === 0 && notApplied.length === 0) return null;

  return (
    <Stack gap={4} maw={360}>
      {lines.map((line) => (
        <div key={line.key}>
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text size="sm">{line.label}</Text>
            <Group gap="xs" wrap="nowrap">
              {onOverride && overridable.includes(line.key) && (
                <Button
                  size="compact-xs"
                  variant="subtle"
                  aria-label={`${line.override ? 'Change the override of' : 'Override'} ${line.label}`}
                  onClick={() => onOverride(line)}
                >
                  {line.override ? 'Change' : 'Override'}
                </Button>
              )}
              {onRemoveOverride && line.override && (
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="red"
                  aria-label={`Remove the override of ${line.label}`}
                  onClick={() => onRemoveOverride(line.override!)}
                >
                  Remove
                </Button>
              )}
              <Text size="sm" fw={line.override ? 600 : undefined}>
                {formatMoney(line.value)}
              </Text>
            </Group>
          </Group>
          {line.override && (
            <OverrideNote
              override={line.override}
              computed={line.computed}
              onRecalculate={
                onRecalculate && recalculable.includes(line.key) && line.computed !== line.value
                  ? () => onRecalculate(line)
                  : undefined
              }
              label={line.label}
            />
          )}
        </div>
      ))}
      {notApplied.map((override) => (
        <Group key={override.id} justify="space-between" wrap="nowrap" gap="xs">
          <Text size="xs" c="dimmed">
            Not in effect: {feeLabel(override.var, ...logics)} set to {formatMoney(override.amount)}{' '}
            ({override.reason}) — there’s no such line now.
          </Text>
          {onRemoveOverride && (
            <Button
              size="compact-xs"
              variant="subtle"
              color="red"
              aria-label={`Remove the override of ${feeLabel(override.var, ...logics)}`}
              onClick={() => onRemoveOverride(override)}
            >
              Remove
            </Button>
          )}
        </Group>
      ))}
    </Stack>
  );
}

function OverrideNote({
  override,
  computed,
  label,
  onRecalculate,
}: {
  override: ApiPricingOverride;
  computed: number;
  label: string;
  /** Sets the override to what the pricing works out now. */
  onRecalculate?: () => void;
}) {
  return (
    <Text size="xs" c="dimmed">
      Overridden (the pricing works out {formatMoney(computed)}): {override.reason}
      {override.created_by_name ? ` — ${override.created_by_name}` : ''}
      {onRecalculate && (
        <>
          {' '}
          <Anchor
            component="button"
            type="button"
            size="xs"
            aria-label={`Recalculate ${label}`}
            onClick={onRecalculate}
          >
            Recalculate
          </Anchor>
        </>
      )}
    </Text>
  );
}

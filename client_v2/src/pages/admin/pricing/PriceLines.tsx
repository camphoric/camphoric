/**
 * A registration's or camper's price lines with their overrides (SPEC §8.4,
 * §8.5; §15, DR-56): the fee breakdown, and for Registrars and Admins, setting,
 * changing or removing a line's amount. A registration's own lines (its
 * donation, the handling fee) are overridden here; its campers' lines on each
 * camper.
 */

import { Stack, Text } from '@mantine/core';
import type {
  ApiCamper,
  ApiEvent,
  ApiPricingOverride,
  JsonLogicPricing,
  PricingResults,
  Scalar,
} from 'api-types';
import { confirmDelete } from 'components/ConfirmDelete';
import { FeeBreakdown, feeLabel, type FeeLine, HANDLING } from 'components/FeeBreakdown';
import { usePermissions } from 'hooks/permissions';
import { useState } from 'react';
import { pricingOverrideHooks } from 'store/entities';

import { OverrideModal } from './OverrideModal';

/** The lines a registrar may override: all but the total (and the handling fee, if charged). */
export function overridableLines(event: ApiEvent, camper: boolean): string[] {
  const logic = camper ? event.camper_pricing_logic : event.registration_pricing_logic;
  const lines = (logic ?? []).map((c) => c.var).filter((v) => v && v !== 'total');
  if (!camper && Number(event.epayment_handling) > 0) lines.push(HANDLING);
  return lines;
}

interface PriceLinesProps {
  event: ApiEvent;
  results: PricingResults;
  /** The logics that label these lines. */
  logics: JsonLogicPricing[];
  registrationId: Scalar;
  /** For a camper's lines; leave out for the registration's own. */
  camper?: ApiCamper;
  /** Labels the promo code's discount line. */
  promoLabel?: string;
}

export function PriceLines({
  event,
  results,
  logics,
  registrationId,
  camper,
  promoLabel,
}: PriceLinesProps) {
  const { canEdit } = usePermissions();
  const { data: overrides } = pricingOverrideHooks.useList(
    camper ? { camper: camper.id } : { registration: registrationId },
  );
  const remove = pricingOverrideHooks.useDelete();
  const [editing, setEditing] = useState<FeeLine | null>(null);

  // A registration's list also has its campers' overrides; those belong to each camper.
  const mine = (overrides ?? []).filter((o) => (camper ? true : o.camper == null));

  const confirmRemove = (override: ApiPricingOverride) =>
    confirmDelete({
      path: 'pricingoverrides',
      id: override.id,
      title: 'Remove override',
      message: (
        <>
          Remove the override of {feeLabel(override.var, ...logics)}? It goes back to what the
          pricing works out.
        </>
      ),
      confirmLabel: 'Remove',
      onConfirm: () => remove.mutate({ id: override.id }),
    });

  return (
    <Stack gap="xs">
      <FeeBreakdown
        results={results}
        logics={logics}
        promoLabel={promoLabel}
        overrides={mine}
        overridable={overridableLines(event, !!camper)}
        onOverride={canEdit ? setEditing : undefined}
        onRemoveOverride={canEdit ? confirmRemove : undefined}
      />
      {!camper && canEdit && (
        <Text size="xs" c="dimmed">
          Campers’ lines (tuition, meals…) are overridden on each camper’s Fees tab.
        </Text>
      )}
      <OverrideModal
        registration={registrationId}
        camper={camper?.id ?? null}
        line={editing}
        onClose={() => setEditing(null)}
      />
    </Stack>
  );
}

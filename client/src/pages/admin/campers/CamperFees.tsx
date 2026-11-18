/**
 * Review a camper's fees and custom charges (SPEC §8.5): the fee breakdown from
 * the camper's `server_pricing_results` (labels via `camper_pricing_logic`) and
 * its total — with Registrars' and Admins' overrides of its lines (DR-56) — plus
 * the custom charges (date, type, amount, notes) with add/remove.
 */

import { Group, Stack, Text, Title } from '@mantine/core';
import type { ApiCamper, ApiEvent } from 'api-types';
import { PriceLines } from 'pages/admin/pricing';
import { registrationHooks } from 'store/entities';
import { formatMoney } from 'utils/money';

import { CustomCharges } from './CustomCharges';

export function CamperFees({ event, camper }: { event: ApiEvent; camper: ApiCamper }) {
  // Its registration's promo code labels a per-camper discount (DR-67).
  const { data: registration } = registrationHooks.useById(camper.registration);

  return (
    <Stack>
      <Title order={4}>Fees &amp; custom charges</Title>
      <PriceLines
        event={event}
        results={camper.server_pricing_results}
        logics={[event.camper_pricing_logic]}
        registrationId={camper.registration}
        camper={camper}
        promoLabel={registration?.promo?.label}
      />
      <Group justify="space-between" maw={360}>
        <Text fw={600}>Total</Text>
        <Text fw={600}>{formatMoney(camper.server_pricing_results.total)}</Text>
      </Group>

      <Text fw={600}>Custom charges</Text>
      <CustomCharges eventId={event.id} registrationId={camper.registration} camper={camper} />
    </Stack>
  );
}

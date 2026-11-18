/**
 * Stories for the custom-charges list (SPEC §8.4, §8.5; §15, DR-170): a camper's
 * charges, and a registration's own (a cancellation fee), as a Registrar sees
 * them and as a Reporter does. The data is put in the query cache, so nothing is
 * fetched. Run `npm run storybook`.
 */

import { Paper } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiCamper, ApiCustomCharge, ApiCustomChargeType, Role } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { useState } from 'react';
import { customChargeHooks, customChargeTypeHooks } from 'store/entities';

import { CustomCharges } from '../CustomCharges';

const EVENT = 7;
const REGISTRATION = 5;
const CAMPER = { id: 9, registration: REGISTRATION } as ApiCamper;

const charge = (fields: Partial<ApiCustomCharge>): ApiCustomCharge => ({
  id: 1,
  registration: REGISTRATION,
  camper: null,
  cancelled_camper: null,
  custom_charge_type: 3,
  amount: '25.00',
  notes: '',
  created_at: '2026-10-02T12:00:00Z',
  updated_at: '2026-10-02T12:00:00Z',
  version: 1,
  ...fields,
});

const TYPES = [
  { id: 3, event: EVENT, name: 'linens', label: 'Linens' },
  { id: 4, event: EVENT, name: 'cancellation_fee', label: 'Cancellation fee' },
] as ApiCustomChargeType[];

const CHARGES = [
  charge({ id: 31, camper: CAMPER.id, notes: 'Sheets' }),
  charge({
    id: 32,
    cancelled_camper: 8,
    custom_charge_type: 4,
    amount: '50.00',
    notes: 'Cancellation: Sam Alpha',
  }),
];

/** A query client that already holds the charges and their types. */
function seeded(camper: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(customChargeTypeHooks.listKey({ event: EVENT }), TYPES);
  client.setQueryData(
    customChargeHooks.listKey(camper ? { camper: CAMPER.id } : { registration: REGISTRATION }),
    camper ? CHARGES.filter((c) => c.camper === CAMPER.id) : CHARGES,
  );
  return client;
}

function Frame({ camper, userRole }: { camper?: boolean; userRole: Role }) {
  const [client] = useState(() => seeded(!!camper));
  return (
    <QueryClientProvider client={client}>
      <PermissionsProvider userRole={userRole}>
        <Paper withBorder p="md" m="md" maw={640}>
          <CustomCharges
            eventId={EVENT}
            registrationId={REGISTRATION}
            camper={camper ? CAMPER : undefined}
          />
        </Paper>
      </PermissionsProvider>
    </QueryClientProvider>
  );
}

export default { title: 'Custom Charges' } satisfies Meta;

export const RegistrationsOwn: StoryFn = () => <Frame userRole="registrar" />;
export const CampersCharges: StoryFn = () => <Frame camper userRole="registrar" />;
export const AsAReporter: StoryFn = () => <Frame userRole="reporter" />;

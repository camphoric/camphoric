/**
 * The live registration total (SPEC §7.1, §9.6). Updates as the form changes and
 * shows a small spinner while the price is recalculating.
 */

import { Group, Loader, Paper, Text } from '@mantine/core';
import { useRegistrationStore } from 'store/registration';
import { formatMoney } from 'utils/money';

export function PriceTicker() {
  const total = useRegistrationStore((state) => state.totals.total);
  const updating = useRegistrationStore((state) => state.updating);

  return (
    <Paper withBorder p="sm" pos="sticky" bottom={0} style={{ zIndex: 1 }}>
      <Group justify="flex-end" gap="xs">
        {updating ? <Loader size="xs" /> : null}
        <Text fw={600}>Total: {formatMoney(total)}</Text>
      </Group>
    </Paper>
  );
}

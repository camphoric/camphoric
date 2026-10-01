/**
 * A registration's or camper's change history (SPEC §8.4, §8.5; §15, DR-53):
 * newest first, each change with when, who (or that no one was signed in, e.g.
 * an online registration), what it was about and each changed field's old and
 * new value. The entries one save made — an edit and the pricing it
 * recalculated — are shown together.
 *
 * `HistoryList` shows entries it's given; `HistoryPanel` fetches them for a
 * registration or camper and names ids (lodging, registration types, charge
 * types) and attributes (the event's schema titles).
 */

import { Card, Group, Stack, Table, Text } from '@mantine/core';
import type { ApiEvent, ApiHistoryEntry, Scalar } from 'api-types';
import { InlineLoading } from 'components/Loading';
import type { JSONSchema7 } from 'json-schema';
import { useMemo } from 'react';
import { type HistoryPath, useDeletedPromoCodes, useHistory } from 'store/deletes';
import {
  customChargeTypeHooks,
  lodgingHooks,
  promoCodeHooks,
  registrationTypeHooks,
} from 'store/entities';
import { apiErrorMessage } from 'utils/fetch';

import {
  actionName,
  changeLines,
  type DescribeOptions,
  groupByRequest,
  objectName,
  schemaTitles,
} from './describe';

export function HistoryList({
  entries,
  options,
}: {
  entries: ApiHistoryEntry[];
  options?: DescribeOptions;
}) {
  if (entries.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No changes recorded yet.
      </Text>
    );
  }
  return (
    <Stack gap="sm">
      {groupByRequest(entries).map((group) => (
        <Card key={group[0].id} withBorder padding="sm">
          <Group justify="space-between" mb="xs" wrap="wrap" gap="xs">
            <Text size="sm" fw={600}>
              {group[0].actor?.name ?? 'No one signed in'}
            </Text>
            <Text size="sm" c="dimmed">
              {new Date(group[0].timestamp).toLocaleString()}
            </Text>
          </Group>
          <Stack gap="xs">
            {group.map((entry) => (
              <EntryLines key={entry.id} entry={entry} options={options} />
            ))}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

function EntryLines({ entry, options }: { entry: ApiHistoryEntry; options?: DescribeOptions }) {
  const lines = changeLines(entry, options);
  return (
    <div>
      <Text size="sm">
        {objectName(entry)}: {actionName(entry).toLowerCase()}
      </Text>
      {lines.length > 0 && (
        <Table withRowBorders={false} verticalSpacing={2} fz="sm">
          <Table.Tbody>
            {lines.map((line) => (
              <Table.Tr key={line.field}>
                <Table.Td c="dimmed" w="35%">
                  {line.field}
                </Table.Td>
                <Table.Td>
                  {line.from} → {line.to}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </div>
  );
}

const byId = <T extends { id: Scalar }>(rows: T[] | undefined, name: (row: T) => string) =>
  Object.fromEntries((rows ?? []).map((row) => [String(row.id), name(row)]));

export function HistoryPanel({
  event,
  path,
  id,
}: {
  event: ApiEvent;
  path: HistoryPath;
  id: Scalar;
}) {
  const history = useHistory(path, id);
  const { data: lodgings } = lodgingHooks.useList({ event: event.id });
  const { data: types } = registrationTypeHooks.useList({ event: event.id });
  const { data: chargeTypes } = customChargeTypeHooks.useList({ event: event.id });
  // A registration keeps a deleted promo code, so its history can name one (DR-67).
  const { data: promoCodes } = promoCodeHooks.useList({ event: event.id });
  const { data: deletedPromoCodes } = useDeletedPromoCodes(event.id);

  const options = useMemo<DescribeOptions>(() => {
    const definitions = (event.registration_schema as JSONSchema7 | undefined)?.definitions;
    const camperSchema = { ...event.camper_schema, definitions };
    const lodgingNames = byId(lodgings, (l) => l.name);
    return {
      titles: {
        registration: schemaTitles(event.registration_schema),
        camper: schemaTitles(camperSchema),
      },
      lookups: {
        lodging: lodgingNames,
        lodging_requested: lodgingNames,
        registration_type: byId(types, (t) => t.label),
        custom_charge_type: byId(chargeTypes, (t) => t.label),
        promo_code: byId([...(promoCodes ?? []), ...(deletedPromoCodes ?? [])], (p) => p.label),
      },
    };
  }, [
    event.registration_schema,
    event.camper_schema,
    lodgings,
    types,
    chargeTypes,
    promoCodes,
    deletedPromoCodes,
  ]);

  if (history.error) {
    return (
      <Text c="red" size="sm">
        Couldn’t load the history: {apiErrorMessage(history.error)}
      </Text>
    );
  }
  if (!history.data) return <InlineLoading message="Loading the history…" />;
  return <HistoryList entries={history.data} options={options} />;
}

/**
 * A registration's or camper's change history (SPEC §8.4, §8.5; §15, DR-53):
 * newest first, each change with when, who (or that no one was signed in, e.g.
 * an online registration), what it was about and each changed field's old and
 * new value — the old reddish, the new greenish. A long value is cut short
 * with a button to see the rest; long JSON or multi-line text shows a diff of
 * just the lines that changed. The entries one save made — an edit and the
 * pricing it recalculated — are shown together.
 *
 * `HistoryList` shows entries it's given; `HistoryPanel` fetches them for a
 * registration or camper and names ids (lodging, registration types, charge
 * types) and attributes (the event's schema titles).
 */

import { Anchor, Box, Card, Group, Stack, Table, Text } from '@mantine/core';
import type { ApiEvent, ApiHistoryEntry, Scalar } from 'api-types';
import { InlineLoading } from 'components/Loading';
import type { JSONSchema7 } from 'json-schema';
import { useMemo, useState } from 'react';
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
  type ChangeLine,
  changeLines,
  type DescribeOptions,
  type DiffLine,
  groupByRequest,
  objectName,
  schemaTitles,
  VALUE_LIMIT,
} from './describe';

export function HistoryList({
  entries,
  options,
  showActor = true,
}: {
  entries: ApiHistoryEntry[];
  options?: DescribeOptions;
  /** Name who made each change (not needed when they're all one person's). */
  showActor?: boolean;
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
            {showActor && (
              <Text size="sm" fw={600}>
                {group[0].actor?.name ?? 'No one signed in'}
              </Text>
            )}
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
        {objectName(entry, options)}: {actionName(entry).toLowerCase()}
      </Text>
      {lines.length > 0 && (
        <Table withRowBorders={false} verticalSpacing={2} fz="sm">
          <Table.Tbody>
            {lines.map((line) => (
              <ChangeRow key={line.field} line={line} />
            ))}
          </Table.Tbody>
        </Table>
      )}
    </div>
  );
}

/** A diff shows this many lines until "Show all". */
export const DIFF_LIMIT = 12;

const clip = (text: string) => `${text.slice(0, VALUE_LIMIT).trimEnd()}…`;

function Value({ text, tone }: { text: string; tone: 'red' | 'green' }) {
  return (
    <Text
      span
      fz="sm"
      px={4}
      c={`var(--mantine-color-${tone}-text)`}
      bg={`var(--mantine-color-${tone}-light)`}
      style={{ borderRadius: 'var(--mantine-radius-xs)', boxDecorationBreak: 'clone' }}
    >
      {text}
    </Text>
  );
}

function ShowAll({
  expanded,
  onToggle,
  label = 'Show all',
}: {
  expanded: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <Anchor component="button" type="button" fz="xs" onClick={onToggle}>
      {expanded ? 'Show less' : label}
    </Anchor>
  );
}

const DIFF_MARK = { same: ' ', removed: '−', added: '+' };
const DIFF_TONE: Record<string, string | undefined> = { removed: 'red', added: 'green' };

/**
 * Changed lines red (−) and green (+), with a little unchanged context; in
 * JSON, each section headed with where it is ("in tuition › exp").
 */
function Diff({ lines }: { lines: DiffLine[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? lines : lines.slice(0, DIFF_LIMIT);
  return (
    <Stack gap={4} align="flex-start">
      <Box
        ff="monospace"
        fz="xs"
        w="100%"
        style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
      >
        {shown.map((line, index) => {
          if (line.kind === 'skip') {
            return (
              <Text key={index} c="dimmed" fz="xs" ff="monospace">
                ⋯ {line.count} unchanged {line.count === 1 ? 'line' : 'lines'}
              </Text>
            );
          }
          if (line.kind === 'where') {
            return (
              <Text key={index} c="dimmed" fz="xs" fs="italic" mt={4} data-diff="where">
                in {line.path}
              </Text>
            );
          }
          const tone = DIFF_TONE[line.kind];
          return (
            <div
              key={index}
              data-diff={line.kind}
              style={
                tone
                  ? {
                      color: `var(--mantine-color-${tone}-text)`,
                      background: `var(--mantine-color-${tone}-light)`,
                    }
                  : undefined
              }
            >
              {DIFF_MARK[line.kind]} {line.text}
            </div>
          );
        })}
      </Box>
      {lines.length > DIFF_LIMIT && (
        <ShowAll
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
          label={`Show all (${lines.length} lines)`}
        />
      )}
    </Stack>
  );
}

function ChangeRow({ line }: { line: ChangeLine }) {
  const [expanded, setExpanded] = useState(false);
  const long = line.from.length > VALUE_LIMIT || line.to.length > VALUE_LIMIT;
  const shown = (text: string) =>
    long && !expanded && text.length > VALUE_LIMIT ? clip(text) : text;
  return (
    // A diff takes the row's full width, under the field's name.
    line.diff ? (
      <Table.Tr>
        <Table.Td colSpan={2}>
          <Text c="dimmed" fz="sm">
            {line.field}
          </Text>
          <Diff lines={line.diff} />
        </Table.Td>
      </Table.Tr>
    ) : (
      <Table.Tr>
        <Table.Td c="dimmed" w="35%">
          {line.field}
        </Table.Td>
        {/* Long values break anywhere. */}
        <Table.Td style={{ overflowWrap: 'anywhere' }}>
          <Value text={shown(line.from)} tone="red" /> →{' '}
          <Value text={shown(line.to)} tone="green" />
          {long && (
            <>
              {' '}
              <ShowAll expanded={expanded} onToggle={() => setExpanded(!expanded)} />
            </>
          )}
        </Table.Td>
      </Table.Tr>
    )
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

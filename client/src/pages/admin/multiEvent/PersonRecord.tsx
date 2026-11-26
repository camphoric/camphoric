/**
 * One person's record across the included events (SPEC §8.12): their camper
 * records by event, oldest first, each opening that camper in its event's
 * admin. A user who can change data can unlink a record linked by mistake, or,
 * to undo a mistaken merge, split some records off together as another person.
 * Two records of one event (left by restoring a deleted one) are pointed out.
 */

import { Alert, Anchor, Button, Checkbox, Group, Stack, Table, Text } from '@mantine/core';
import type { ApiMultiEventCamper, ApiMultiEventEvent } from 'api-types';
import { usePermissions } from 'hooks/permissions';
import { useState } from 'react';

import type { PersonUnit } from './people';

interface PersonRecordProps {
  unit: PersonUnit;
  /** The organization's events, by id. */
  events: Map<number, ApiMultiEventEvent>;
  onOpenCamper: (record: ApiMultiEventCamper) => void;
  /** Take records out of the person: one is then linked to no one, more stay together. */
  onUnlink?: (records: ApiMultiEventCamper[]) => void;
  /** Whether an unlink is being saved. */
  unlinking?: boolean;
}

export function PersonRecord({
  unit,
  events,
  onOpenCamper,
  onUnlink,
  unlinking = false,
}: PersonRecordProps) {
  const { canEdit } = usePermissions();
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const eventName = (id: number) => events.get(id)?.name ?? `Event ${id}`;
  const linked = unit.person !== null;
  const canUnlink = canEdit && linked && !!onUnlink;
  // Splitting off needs two to go and one to stay.
  const canSplit = canUnlink && unit.records.length >= 3;
  const splitting = unit.records.filter((r) => chosen.has(r.camper));
  const toggle = (camper: number) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(camper)) next.delete(camper);
      else next.add(camper);
      return next;
    });

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {linked
          ? `${unit.records.length} camper records linked as one person.`
          : 'This camper record isn’t linked to any other.'}
      </Text>
      {unit.clashes.length > 0 && (
        <Alert color="yellow" title="More than one record in an event">
          A person has one camper record per event, but this person has more than one in{' '}
          {unit.clashes.map(eventName).join(', ')}. Unlink the one that isn’t theirs.
        </Alert>
      )}
      {canSplit && (
        <Group gap="xs">
          <Button
            size="xs"
            variant="default"
            disabled={splitting.length < 2 || splitting.length >= unit.records.length}
            loading={unlinking && splitting.length >= 2}
            onClick={() => {
              onUnlink?.(splitting);
              setChosen(new Set());
            }}
          >
            {splitting.length >= 2
              ? `Split off ${splitting.length} as another person`
              : 'Split off as another person'}
          </Button>
          <Text size="xs" c="dimmed">
            To undo a mistaken link, choose the records that are someone else’s.
          </Text>
        </Group>
      )}
      <Table.ScrollContainer minWidth={560}>
        <Table verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              {canSplit && <Table.Th />}
              <Table.Th>Event</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Age</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Registrant email</Table.Th>
              {canUnlink && <Table.Th />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {unit.records.map((record) => (
              <Table.Tr key={record.camper}>
                {canSplit && (
                  <Table.Td>
                    <Checkbox
                      aria-label={`Choose the ${eventName(record.event)} record`}
                      checked={chosen.has(record.camper)}
                      onChange={() => toggle(record.camper)}
                    />
                  </Table.Td>
                )}
                <Table.Td>
                  <Anchor
                    component="button"
                    type="button"
                    ta="left"
                    onClick={() => onOpenCamper(record)}
                  >
                    {eventName(record.event)}
                  </Anchor>
                </Table.Td>
                <Table.Td>{record.name}</Table.Td>
                <Table.Td>{record.age ?? ''}</Table.Td>
                <Table.Td>{record.email ?? ''}</Table.Td>
                <Table.Td>{record.registrant_email ?? ''}</Table.Td>
                {canUnlink && (
                  <Table.Td>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="red"
                      disabled={unlinking}
                      onClick={() => onUnlink?.([record])}
                    >
                      Unlink
                    </Button>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}

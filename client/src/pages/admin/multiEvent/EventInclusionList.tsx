/**
 * Which of the organization's events take part in multi-event reports, and the
 * series each belongs to (SPEC §8.12). An event is included or left out at
 * once; a series name is saved when it's entered (on Enter, leaving the field,
 * or picking one of the names already in use), and can be entered again if the
 * save fails. For a user who can't change data (a Reporter) both are shown but
 * disabled.
 */

import { Autocomplete, Switch, Table, Text } from '@mantine/core';
import type { ApiMultiEventEvent, MultiEventInclusionRequest } from 'api-types';
import { usePermissions } from 'hooks/permissions';
import { useRef, useState } from 'react';

interface EventInclusionListProps {
  /** The organization's events, in the event chooser's order. */
  events: ApiMultiEventEvent[];
  /** Saves a change; a promise it returns says whether the save failed. */
  onChange: (event: number, change: MultiEventInclusionRequest) => void | Promise<unknown>;
  /** The event whose change is being saved. */
  saving?: number | null;
}

function when(event: ApiMultiEventEvent): string {
  if (event.start) return event.start.slice(0, 4);
  return event.registration_start ? event.registration_start.slice(0, 4) : '';
}

function SeriesInput({
  event,
  names,
  disabled,
  onSave,
}: {
  event: ApiMultiEventEvent;
  names: string[];
  disabled: boolean;
  onSave: (series: string) => void | Promise<unknown>;
}) {
  // Starts again from the saved name whenever it changes (the caller keys it by the name).
  const [draft, setDraft] = useState(event.series);
  // What was last saved, so Enter and then leaving the field save it once.
  const saved = useRef(event.series);
  const save = (value: string) => {
    const series = value.trim().replace(/\s+/g, ' ');
    if (series === saved.current) return;
    const before = saved.current;
    saved.current = series;
    // A failed save (the error is shown) can be tried again.
    void Promise.resolve(onSave(series)).catch(() => {
      if (saved.current === series) saved.current = before;
    });
  };
  return (
    <Autocomplete
      aria-label={`Series of ${event.name}`}
      placeholder="No series"
      size="xs"
      data={names}
      maxLength={100}
      value={draft}
      onChange={setDraft}
      onOptionSubmit={save}
      onBlur={() => save(draft)}
      onKeyDown={(e) => {
        // Enter on a highlighted suggestion submits that option instead (onOptionSubmit),
        // so saving the half-typed text as well would send two saves.
        if (e.key === 'Enter' && !e.currentTarget.getAttribute('aria-activedescendant')) {
          save(draft);
        }
      }}
      disabled={disabled}
    />
  );
}

export function EventInclusionList({ events, onChange, saving }: EventInclusionListProps) {
  const { canEdit } = usePermissions();
  const names = [...new Set(events.map((e) => e.series).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );

  if (events.length === 0) return <Text c="dimmed">No events for this organization.</Text>;

  return (
    <Table.ScrollContainer minWidth={420}>
      <Table verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Event</Table.Th>
            <Table.Th>Year</Table.Th>
            <Table.Th>Series</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {events.map((event) => (
            <Table.Tr key={event.event}>
              <Table.Td>
                <Switch
                  label={event.name}
                  checked={event.included}
                  disabled={!canEdit || saving === event.event}
                  onChange={(e) =>
                    // A failed save is shown; the switch then shows what's saved.
                    void Promise.resolve(
                      onChange(event.event, { included: e.currentTarget.checked }),
                    ).catch(() => undefined)
                  }
                />
              </Table.Td>
              <Table.Td>{when(event)}</Table.Td>
              <Table.Td>
                <SeriesInput
                  key={event.series}
                  event={event}
                  names={names}
                  // Not held while the switch saves: what's being typed would be lost.
                  disabled={!canEdit}
                  onSave={(series) => onChange(event.event, { series })}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

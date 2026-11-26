/**
 * Multi-event reports' People section (SPEC §8.12; §15 DR-177, DR-178): the
 * people across the included events — each person's linked camper records
 * together, and each record linked to no one on its own — searchable and
 * sortable, with one person's record open at a time (`?personId`, or
 * `?camperId` for a record linked to no one). A user who can change data
 * picks two or more and links them as one person, unlinks a record from a
 * person's record, and reviews the suggested matches (`?peopleTab=suggestions`):
 * linking one, or saying they aren't the same person.
 */

import {
  Button,
  Checkbox,
  Group,
  Modal,
  Pagination,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { ApiMultiEventCamper, ApiPersonSuggestion, MatchLevel } from 'api-types';
import { DataTable, type DataTableColumnDef } from 'components/DataTable';
import { InlineLoading } from 'components/Loading';
import { usePermissions } from 'hooks/permissions';
import { createContext, useContext, useMemo, useState } from 'react';
import {
  useDismissSuggestion,
  useLinkRecords,
  useMultiEventCampers,
  useMultiEventEvents,
  usePersonSuggestions,
  useUnlinkRecords,
} from 'store/multiEvent';
import { tableStateFromSearch, tableStateToSearch } from 'utils/tableUrlState';

import { chronologicalOrder, groupPeople, type PersonUnit, sharedEvents } from './people';
import { PersonRecord } from './PersonRecord';
import { LEVEL_LABEL, SuggestionList } from './SuggestionList';

const FROM = '/admin/organization/$organizationId/multi-event';
const SUGGESTIONS_PER_PAGE = 20;
const LEVELS: MatchLevel[] = ['strong', 'likely', 'possible'];

/** "1 person", "3 people"; "1 included event", "2 included events". */
function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The people chosen for linking. The checkbox cell reads them from here, so
 * the table's columns stay the same as they change: new columns would remount
 * every cell, and the checkbox just ticked would lose focus.
 */
const ChosenContext = createContext<{ chosen: Set<string>; toggle: (key: string) => void }>({
  chosen: new Set(),
  toggle: () => undefined,
});

function ChooseCell({ row }: { row: { original: PersonUnit } }) {
  const { chosen, toggle } = useContext(ChosenContext);
  return (
    <Checkbox
      aria-label={`Choose ${row.original.name}`}
      checked={chosen.has(row.original.key)}
      onClick={(e) => e.stopPropagation()}
      onChange={() => toggle(row.original.key)}
    />
  );
}

export function MultiEventPeople() {
  const { organizationId } = useParams({ from: FROM });
  const search = useSearch({ from: FROM });
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const events = useMultiEventEvents(organizationId);
  const campers = useMultiEventCampers(organizationId);
  const suggestions = usePersonSuggestions(organizationId);
  const link = useLinkRecords(organizationId);
  const unlink = useUnlinkRecords(organizationId);
  const dismiss = useDismissSuggestion(organizationId);
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const setSearch = (patch: Record<string, string | undefined>) =>
    void navigate({
      to: '/admin/organization/$organizationId/multi-event/people',
      params: { organizationId },
      search: (prev) => ({ ...prev, ...patch }),
    });

  const eventsById = useMemo(
    () => new Map((events.data ?? []).map((event) => [event.event, event])),
    [events.data],
  );
  const recordsById = useMemo(
    () => new Map((campers.data ?? []).map((record) => [record.camper, record])),
    [campers.data],
  );
  const units = useMemo(
    () => groupPeople(campers.data ?? [], events.data ?? []),
    [campers.data, events.data],
  );
  const order = useMemo(() => chronologicalOrder(events.data ?? []), [events.data]);
  const unitsByKey = useMemo(() => new Map(units.map((unit) => [unit.key, unit])), [units]);

  const selected = search.personId
    ? unitsByKey.get(`person:${search.personId}`)
    : search.camperId
      ? units.find((unit) => unit.records.some((r) => String(r.camper) === search.camperId))
      : undefined;

  const select = (unit?: PersonUnit) =>
    setSearch({
      personId: unit?.person ? String(unit.person) : undefined,
      camperId: unit && !unit.person ? String(unit.records[0].camper) : undefined,
    });

  const openCamper = (record: ApiMultiEventCamper) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/campers',
      params: { organizationId, eventId: String(record.event) },
      search: { camperId: String(record.camper) },
    });

  const eventName = (id: number) => eventsById.get(id)?.name ?? `Event ${id}`;
  const toggle = (key: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const chosenUnits = [...chosen]
    .map((key) => unitsByKey.get(key))
    .filter((u): u is PersonUnit => !!u);
  const clashes = sharedEvents(chosenUnits);

  const linkChosen = () =>
    link.mutate(
      chosenUnits.flatMap((unit) => unit.records.map((r) => r.camper)),
      {
        onSuccess: (result) => {
          setChosen(new Set());
          setSearch({ personId: String(result.person), camperId: undefined });
        },
      },
    );

  const columns = useMemo<DataTableColumnDef<PersonUnit>[]>(
    () => [
      ...(canEdit
        ? [
            {
              id: 'choose',
              header: '',
              enableSorting: false,
              accessorFn: (unit: PersonUnit) => unit.key,
              cell: ChooseCell,
            } satisfies DataTableColumnDef<PersonUnit>,
          ]
        : []),
      { id: 'name', header: 'Name', accessorFn: (unit) => unit.name },
      {
        id: 'attended',
        header: 'Events',
        accessorFn: (unit) => new Set(unit.records.map((r) => r.event)).size,
      },
      {
        id: 'latest',
        header: 'Most recent',
        accessorFn: (unit) => order.get(unit.records[unit.records.length - 1].event) ?? -1,
        cell: (info) => eventName(info.row.original.records.at(-1)!.event),
      },
      { id: 'age', header: 'Age', accessorFn: (unit) => unit.age ?? '' },
      { id: 'email', header: 'Email', accessorFn: (unit) => unit.emails.join(', ') },
      {
        id: 'linked',
        header: 'Linked',
        accessorFn: (unit) => (unit.person ? unit.records.length : 0),
        cell: (info) =>
          info.row.original.person ? plural(info.row.original.records.length, 'record') : '',
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, order, eventsById],
  );

  if (!events.data || !campers.data) return <InlineLoading />;

  const includedCount = events.data.filter((e) => e.included).length;
  if (includedCount === 0) {
    return (
      <Stack>
        <Title order={2}>People</Title>
        <Text c="dimmed">
          No events are included yet. Choose them in{' '}
          <Link
            to="/admin/organization/$organizationId/multi-event/events"
            params={{ organizationId }}
          >
            Events
          </Link>
          .
        </Text>
      </Stack>
    );
  }

  const tab = search.peopleTab === 'suggestions' ? 'suggestions' : 'people';
  const level = LEVELS.find((l) => l === search.matchLevel);
  const shown = (suggestions.data ?? []).filter((s) => !level || s.level === level);
  const pages = Math.max(1, Math.ceil(shown.length / SUGGESTIONS_PER_PAGE));
  const page = Math.min(Math.max(1, Number(search.matchpage) || 1), pages);
  const pageOfSuggestions = shown.slice(
    (page - 1) * SUGGESTIONS_PER_PAGE,
    page * SUGGESTIONS_PER_PAGE,
  );
  const busy =
    link.isPending && tab === 'suggestions'
      ? link.variables[0]
      : dismiss.isPending
        ? dismiss.variables[0]
        : null;
  const linkSuggestion = (s: ApiPersonSuggestion) => link.mutate(s.campers);
  const dismissSuggestion = (s: ApiPersonSuggestion) => dismiss.mutate(s.campers);
  const linkedCount = units.filter((u) => u.person).length;

  return (
    <Stack>
      <Title order={2}>People</Title>
      <Tabs
        value={tab}
        onChange={(value) =>
          setSearch({ peopleTab: value === 'suggestions' ? 'suggestions' : undefined })
        }
      >
        <Tabs.List>
          <Tabs.Tab value="people">People</Tabs.Tab>
          <Tabs.Tab value="suggestions">
            Suggested matches{suggestions.data ? ` (${suggestions.data.length})` : ''}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="people" pt="md">
          <Stack>
            <Text size="sm" c="dimmed">
              {plural(units.length, 'person', 'people')} across{' '}
              {plural(includedCount, 'included event')}, from{' '}
              {plural(campers.data.length, 'camper record')}; {linkedCount} of them linked across
              events.
              {canEdit && ' Choose two or more to link them as one person.'}
            </Text>
            {/* Always there for an editor, so choosing the first doesn't move the rows. */}
            {canEdit && (
              <Group gap="xs">
                <Button
                  size="xs"
                  onClick={linkChosen}
                  loading={link.isPending}
                  disabled={chosenUnits.length < 2 || clashes.length > 0}
                >
                  {chosenUnits.length >= 2
                    ? `Link ${chosenUnits.length} as one person`
                    : 'Link as one person'}
                </Button>
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => setChosen(new Set())}
                  disabled={chosenUnits.length === 0}
                >
                  Clear
                </Button>
                {clashes.length > 0 && (
                  <Text size="sm" c="red">
                    These can’t be one person: more than one of them was at{' '}
                    {clashes.map(eventName).join(', ')}.
                  </Text>
                )}
              </Group>
            )}
            <ChosenContext.Provider value={{ chosen, toggle }}>
              <DataTable
                data={units}
                columns={columns}
                searchKeys={[(unit) => unit.names, (unit) => unit.emails]}
                searchPlaceholder="Search people…"
                onRowClick={select}
                isRowSelected={(unit) => unit === selected}
                emptyMessage="No camper records in the included events."
                state={tableStateFromSearch(search, 'ppl')}
                onStateChange={(next) => setSearch(tableStateToSearch(next, 'ppl'))}
              />
            </ChosenContext.Provider>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="suggestions" pt="md">
          <Stack>
            <Text size="sm" c="dimmed" maw={720}>
              Camper records from different events that are likely one person, by their names and
              email addresses. Nothing is linked until it’s accepted.
            </Text>
            <SegmentedControl
              size="xs"
              style={{ alignSelf: 'flex-start' }}
              value={level ?? 'all'}
              onChange={(value) =>
                setSearch({ matchLevel: value === 'all' ? undefined : value, matchpage: undefined })
              }
              data={[
                { value: 'all', label: 'All' },
                ...LEVELS.map((l) => ({ value: l, label: LEVEL_LABEL[l] })),
              ]}
            />
            {suggestions.data ? (
              <SuggestionList
                suggestions={pageOfSuggestions}
                records={recordsById}
                events={eventsById}
                onLink={linkSuggestion}
                onDismiss={dismissSuggestion}
                onOpenCamper={openCamper}
                busy={busy}
              />
            ) : (
              <InlineLoading />
            )}
            {pages > 1 && (
              <Pagination
                total={pages}
                value={page}
                onChange={(next) => setSearch({ matchpage: next > 1 ? String(next) : undefined })}
              />
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={!!selected}
        onClose={() => select(undefined)}
        title={selected?.name ?? ''}
        size="64rem"
      >
        {selected && (
          <PersonRecord
            unit={selected}
            events={eventsById}
            onOpenCamper={openCamper}
            onUnlink={(records) =>
              unlink.mutate(
                records.map((r) => r.camper),
                {
                  // Records split off together open as the person they now are.
                  onSuccess: ({ person }) => {
                    if (person) setSearch({ personId: String(person), camperId: undefined });
                  },
                },
              )
            }
            unlinking={unlink.isPending}
          />
        )}
      </Modal>
    </Stack>
  );
}

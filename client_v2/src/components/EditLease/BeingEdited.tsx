/**
 * Marks a record in a list as being edited by someone else (SPEC §9.8; §15,
 * DR-110): a small pencil whose tooltip says who and since when. The open
 * event's leases come from `EventLeasesProvider` (around the event's admin),
 * kept current by the live feed; this tab's own lease isn't marked.
 */

import { Group, ThemeIcon, Tooltip } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import type { ApiEditLease, Scalar } from 'api-types';
import { useCurrentUser } from 'hooks/auth';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { CLIENT_ID, useEventLeases } from 'store/leases';

interface EventLeases {
  /** Others' leases by `${model}:${id}`. */
  byRecord: Map<string, ApiEditLease>;
  myId: number | undefined;
}

const EventLeasesContext = createContext<EventLeases>({ byRecord: new Map(), myId: undefined });

const recordKey = (model: string, id: Scalar) => `${model}:${String(id)}`;

/** The open event's leases, for the markers in its lists. */
export function EventLeasesProvider({
  eventId,
  children,
}: {
  eventId: Scalar | undefined;
  children: ReactNode;
}) {
  const { data: leases } = useEventLeases(eventId);
  const { data: user } = useCurrentUser();
  const value = useMemo<EventLeases>(
    () => ({
      byRecord: new Map(
        (leases ?? [])
          .filter((lease) => lease.client_id !== CLIENT_ID)
          .map((lease) => [recordKey(lease.model, lease.object_id), lease]),
      ),
      myId: user?.id ?? undefined,
    }),
    [leases, user?.id],
  );
  return <EventLeasesContext.Provider value={value}>{children}</EventLeasesContext.Provider>;
}

/** Someone else's lease on the record, if they hold one. */
export function useBeingEdited(model: string, id: Scalar): ApiEditLease | undefined {
  return useContext(EventLeasesContext).byRecord.get(recordKey(model, id));
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function BeingEditedView({
  lease,
  isYou,
  size = 'sm',
}: {
  lease: ApiEditLease;
  isYou: boolean;
  /** `xs` for tight spots (a camper's bar on the lodging timeline). */
  size?: 'xs' | 'sm';
}) {
  const who = isYou
    ? 'You are editing this in another tab'
    : `${lease.holder.name} is editing this`;
  const label = `${who} (since ${time(lease.acquired_at)})`;
  return (
    <Tooltip label={label} withArrow>
      <ThemeIcon
        size={size}
        radius="xl"
        variant="light"
        color="blue"
        aria-label={label}
        role="img"
        style={{ flexShrink: 0, verticalAlign: 'middle' }}
      >
        <IconPencil size={size === 'xs' ? 10 : 12} />
      </ThemeIcon>
    </Tooltip>
  );
}

/** The marker for a record in a list, when someone else is editing it. */
export function BeingEdited({
  model,
  id,
  size,
}: {
  model: string;
  id: Scalar;
  size?: 'xs' | 'sm';
}) {
  const lease = useBeingEdited(model, id);
  const { myId } = useContext(EventLeasesContext);
  if (!lease) return null;
  return <BeingEditedView lease={lease} isYou={lease.holder.id === myId} size={size} />;
}

/** A record's name in a list, marked when someone else is editing it. */
export function WithBeingEdited({
  model,
  id,
  children,
}: {
  model: string;
  id: Scalar;
  children: ReactNode;
}) {
  return (
    <Group gap={6} wrap="nowrap" component="span" style={{ display: 'inline-flex' }}>
      <span>{children}</span>
      <BeingEdited model={model} id={id} />
    </Group>
  );
}

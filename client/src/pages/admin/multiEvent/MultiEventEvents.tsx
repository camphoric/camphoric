/**
 * Multi-event reports' Events section (SPEC §8.12): choose which of the
 * organization's events are included, and group them into series so stats
 * compare like with like. The choice is the organization's, saved on the
 * server, so every organizer sees the same set.
 */

import { Stack, Text, Title } from '@mantine/core';
import { useParams } from '@tanstack/react-router';
import { InlineLoading } from 'components/Loading';
import { useMultiEventEvents, useSetInclusion } from 'store/multiEvent';

import { EventInclusionList } from './EventInclusionList';

const FROM = '/admin/organization/$organizationId/multi-event';

export function MultiEventEvents() {
  const { organizationId } = useParams({ from: FROM });
  const events = useMultiEventEvents(organizationId);
  const setInclusion = useSetInclusion(organizationId);

  return (
    <Stack>
      <Title order={2}>Events</Title>
      <Text size="sm" c="dimmed" maw={720}>
        Multi-event reports look across the events included here. Give events of the same kind the
        same series name (say, every year of the main camp) so stats compare each with the one
        before it.
      </Text>
      {events.data ? (
        <EventInclusionList
          events={events.data}
          onChange={(event, change) => setInclusion.mutateAsync({ event, ...change })}
          saving={setInclusion.isPending ? setInclusion.variables.event : null}
        />
      ) : (
        <InlineLoading />
      )}
    </Stack>
  );
}

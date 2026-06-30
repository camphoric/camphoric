/**
 * Public splash / default page (SPEC §4). Lists the public events with their
 * open/closed status and a registration link for the open ones, plus a link to
 * the admin surface. Data comes from the public `GET /api/eventlist`.
 */

import { Alert, Anchor, Badge, Card, Container, Group, Stack, Text, Title } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { InlineLoading } from 'components/Loading';
import { DateTime } from 'luxon';
import { usePublicEvents } from 'store/publicEvents';

/** The registration URL is `/events/<id>/register`; pull the id for a typed Link. */
const eventIdFromUrl = (url: string) => url.match(/\/events\/(\d+)\/register/)?.[1];

/** Human-friendly date for a registration-close date, e.g. "Oct 15, 2026". */
const formatDate = (iso: string) => {
  const dt = DateTime.fromISO(iso, { zone: 'utc' });
  return dt.isValid ? dt.toFormat('LLL d, yyyy') : null;
};

export function Splash() {
  const { data: events, isLoading, isError } = usePublicEvents();

  return (
    <Container size="sm" py="xl">
      <Stack>
        <Group justify="space-between" align="center">
          <Title order={1}>Camphoric</Title>
          <Anchor component={Link} to="/admin">
            Admin →
          </Anchor>
        </Group>

        {isLoading && <InlineLoading message="Loading events…" />}
        {isError && (
          <Alert color="red" variant="light">
            Couldn’t load the event list.
          </Alert>
        )}
        {events && events.length === 0 && <Text c="dimmed">There are no public events.</Text>}

        {events?.map((event) => {
          const eventId = eventIdFromUrl(event.url);
          const closeDate = event.registration_end && formatDate(event.registration_end);
          return (
            <Card key={event.url} withBorder>
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Text fw={500}>{event.name}</Text>
                  {closeDate && (
                    <Text size="xs" c="dimmed">
                      Registration {event.open ? 'closes' : 'closed'} {closeDate}
                    </Text>
                  )}
                </Stack>
                <Group gap="md" wrap="nowrap">
                  <Badge color={event.open ? 'green' : 'gray'} variant="light">
                    {event.open ? 'Open' : 'Closed'}
                  </Badge>
                  {event.open && eventId && (
                    <Link
                      to="/events/$eventId/register"
                      params={{ eventId }}
                      style={{ color: 'var(--mantine-color-anchor)' }}
                    >
                      Register →
                    </Link>
                  )}
                </Group>
              </Group>
            </Card>
          );
        })}
      </Stack>
    </Container>
  );
}

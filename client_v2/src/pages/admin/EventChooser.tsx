/**
 * Event chooser (SPEC §8.1). Lists the organization's events; selecting one
 * navigates into the Event Admin container for that event.
 */

import { Card, Container, Stack, Text, Title } from '@mantine/core';
import { Link, useParams } from '@tanstack/react-router';
import { InlineLoading } from 'components/Loading';
import { eventHooks } from 'store/entities';

export function EventChooser() {
  const { organizationId } = useParams({ from: '/admin/organization/$organizationId/event' });
  const { data: events, isLoading } = eventHooks.useList({ organization: organizationId });

  if (isLoading) return <InlineLoading />;

  return (
    <Container size="sm" py="lg">
      <Title order={3} mb="md">
        Choose an event
      </Title>
      <Stack>
        {(events ?? []).map((event) => (
          <Link
            key={event.id}
            to="/admin/organization/$organizationId/event/$eventId/home"
            params={{ organizationId, eventId: String(event.id) }}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Card withBorder padding="md">
              {event.name}
            </Card>
          </Link>
        ))}
        {events?.length === 0 ? <Text c="dimmed">No events for this organization.</Text> : null}
      </Stack>
    </Container>
  );
}

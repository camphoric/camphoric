/**
 * Event chooser (SPEC §8.1). Lists the organization's events in the API's
 * order (no open date yet first, then newest open date first, then by name);
 * selecting one navigates into the Event Admin container for that event. It
 * also leads to the organization's multi-event reports (§8.12). The way back to
 * organization selection is in the frame's header (AdminFrame).
 */

import { Button, Card, Container, Group, Stack, Text, Title } from '@mantine/core';
import { IconChartBar } from '@tabler/icons-react';
import { Link, useParams } from '@tanstack/react-router';
import { InlineLoading } from 'components/Loading';
import { eventHooks } from 'store/entities';

export function EventChooser() {
  const { organizationId } = useParams({ from: '/admin/frame/organization/$organizationId/event' });
  const { data: events, isLoading } = eventHooks.useList({ organization: organizationId });

  if (isLoading) return <InlineLoading />;

  return (
    <Container size="sm" py="lg">
      <Group justify="space-between" mb="md" gap="xs">
        <Title order={3}>Choose an event</Title>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconChartBar size={16} />}
          renderRoot={(props) => (
            <Link
              {...props}
              to="/admin/organization/$organizationId/multi-event/events"
              params={{ organizationId }}
            />
          )}
        >
          Multi-event reports
        </Button>
      </Group>
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

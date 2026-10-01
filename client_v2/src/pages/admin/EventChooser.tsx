/**
 * Event chooser (SPEC §8.1). Lists the organization's events; selecting one
 * navigates into the Event Admin container for that event. A back arrow
 * returns to organization selection.
 */

import { ActionIcon, Card, Container, Group, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link, useParams } from '@tanstack/react-router';
import { InlineLoading } from 'components/Loading';
import { eventHooks } from 'store/entities';

export function EventChooser() {
  const { organizationId } = useParams({ from: '/admin/frame/organization/$organizationId/event' });
  const { data: events, isLoading } = eventHooks.useList({ organization: organizationId });

  if (isLoading) return <InlineLoading />;

  return (
    <Container size="sm" py="lg">
      <Group gap="xs" mb="md" wrap="nowrap">
        <ActionIcon
          component={Link}
          to="/admin/organization"
          variant="subtle"
          color="gray"
          aria-label="Back to organization selection"
          title="Back to organization selection"
        >
          <IconArrowLeft size={18} />
        </ActionIcon>
        <Title order={3}>Choose an event</Title>
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

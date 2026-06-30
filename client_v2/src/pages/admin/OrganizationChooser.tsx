/**
 * Organization chooser (SPEC §8.1). Lists organizations; selecting one navigates
 * to its event chooser.
 */

import { Card, Container, Stack, Text, Title } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { InlineLoading } from 'components/Loading';
import { organizationHooks } from 'store/entities';

export function OrganizationChooser() {
  const { data: organizations, isLoading } = organizationHooks.useList();

  if (isLoading) return <InlineLoading />;

  return (
    <Container size="sm" py="lg">
      <Title order={3} mb="md">
        Choose an organization
      </Title>
      <Stack>
        {(organizations ?? []).map((org) => (
          <Link
            key={org.id}
            to="/admin/organization/$organizationId/event"
            params={{ organizationId: String(org.id) }}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Card withBorder padding="md">
              {org.name}
            </Card>
          </Link>
        ))}
        {organizations?.length === 0 ? <Text c="dimmed">No organizations.</Text> : null}
      </Stack>
    </Container>
  );
}

/**
 * Organization chooser (SPEC §8.1). Lists organizations; selecting one navigates
 * to its event chooser. Admins can also add, rename and delete organizations
 * (§15, DR-50); one that still has events can't be deleted.
 */

import {
  ActionIcon,
  Button,
  Card,
  Container,
  Group,
  Menu,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconDots, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import type { ApiOrganization } from 'api-types';
import { InlineLoading } from 'components/Loading';
import { usePermissions } from 'hooks/permissions';
import { useState } from 'react';
import { organizationHooks } from 'store/entities';

/** The organization being named: a new one, or one being renamed. */
type Naming = { organization?: ApiOrganization } | null;

export function OrganizationChooser() {
  const { data: organizations, isLoading } = organizationHooks.useList();
  const { canManageOrganizations } = usePermissions();
  const create = organizationHooks.useCreate();
  const update = organizationHooks.useUpdate();
  const remove = organizationHooks.useDelete();
  const [naming, setNaming] = useState<Naming>(null);

  if (isLoading) return <InlineLoading />;

  const confirmDelete = (organization: ApiOrganization) =>
    modals.openConfirmModal({
      title: 'Delete organization',
      children: (
        <Text size="sm">Delete “{organization.name}”? This only works when it has no events.</Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        remove.mutate(
          { id: organization.id },
          {
            onSuccess: () =>
              notifications.show({ color: 'green', message: `Deleted ${organization.name}.` }),
          },
        ),
    });

  const saveName = (name: string) => {
    const done = () => setNaming(null);
    if (naming?.organization)
      update.mutate({ id: naming.organization.id, name }, { onSuccess: done });
    else create.mutate({ name }, { onSuccess: done });
  };

  return (
    <Container size="sm" py="lg">
      <Group justify="space-between" mb="md">
        <Title order={3}>Choose an organization</Title>
        {canManageOrganizations && (
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => setNaming({})}
          >
            New organization
          </Button>
        )}
      </Group>
      <Stack>
        {(organizations ?? []).map((org) => (
          <Group key={org.id} gap="xs" wrap="nowrap">
            <Link
              to="/admin/organization/$organizationId/event"
              params={{ organizationId: String(org.id) }}
              style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}
            >
              <Card withBorder padding="md">
                {org.name}
              </Card>
            </Link>
            {canManageOrganizations && (
              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <ActionIcon variant="subtle" aria-label={`Change ${org.name}`}>
                    <IconDots size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconPencil size={16} />}
                    onClick={() => setNaming({ organization: org })}
                  >
                    Rename
                  </Menu.Item>
                  <Menu.Item
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    onClick={() => confirmDelete(org)}
                  >
                    Delete
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        ))}
        {organizations?.length === 0 ? <Text c="dimmed">No organizations.</Text> : null}
      </Stack>

      <Modal
        opened={naming !== null}
        onClose={() => setNaming(null)}
        title={naming?.organization ? 'Rename organization' : 'New organization'}
      >
        {naming !== null && (
          <OrganizationNameForm
            initial={naming.organization?.name ?? ''}
            saving={create.isPending || update.isPending}
            onSubmit={saveName}
            onCancel={() => setNaming(null)}
          />
        )}
      </Modal>
    </Container>
  );
}

function OrganizationNameForm({
  initial,
  saving,
  onSubmit,
  onCancel,
}: {
  initial: string;
  saving: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name.trim());
      }}
    >
      <Stack>
        <TextInput
          label="Name"
          data-autofocus
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim()} loading={saving}>
            Save
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

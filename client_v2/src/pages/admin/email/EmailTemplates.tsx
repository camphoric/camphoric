/**
 * The event's email templates (SPEC §8.9; §15 DR-45):
 * - Automatic emails: the registration confirmation and each registration
 *   type's invitation. They're sent by registering and inviting, and edited
 *   where those are set up (Home, and Settings' registration types).
 * - Group emails: templates with a default audience, sent when an admin
 *   chooses. Create, edit (`?templateId`, `new` for a new one), duplicate or
 *   delete one.
 */

import {
  ActionIcon,
  Anchor,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconCopy, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import type { ApiEmailTemplate, ApiEvent } from 'api-types';
import { InlineLoading } from 'components/Loading';
import { emailTemplateHooks } from 'store/entities';
import { useDuplicateTemplate } from 'store/groupEmail';
import { apiErrorMessage } from 'utils/fetch';

import { SOURCE_LABEL } from './audience';
import { formatTime } from './emailLabels';
import { GroupTemplateEditor } from './GroupTemplateEditor';

interface EmailTemplatesProps {
  event: ApiEvent;
  /** The template being edited: an id, `new`, or none. */
  templateId?: string;
  onEditTemplate: (templateId?: string) => void;
  /** The Template Help page (without a context). */
  helpBase?: string;
}

/** How a group template's default audience reads in the list. */
export function audienceSummary(template: ApiEmailTemplate) {
  if (template.recipient_source === 'manual') {
    const count = template.recipient_list
      .split('\n')
      .filter((line) => line.trim() && !line.trim().startsWith('#')).length;
    return `${count} listed ${count === 1 ? 'address' : 'addresses'}`;
  }
  const rules = template.filter?.rules?.length ?? 0;
  const narrowed = rules || template.filter_expression.trim();
  return `${SOURCE_LABEL[template.recipient_source]}${
    narrowed
      ? `, ${rules ? `${rules} ${rules === 1 ? 'condition' : 'conditions'}` : 'filtered'}`
      : ', all'
  }`;
}

export function EmailTemplates({
  event,
  templateId,
  onEditTemplate,
  helpBase,
}: EmailTemplatesProps) {
  const { data: templates } = emailTemplateHooks.useList({ event: event.id });
  const duplicate = useDuplicateTemplate();
  const del = emailTemplateHooks.useDelete();
  const narrow = useMediaQuery('(max-width: 48em)');

  const organizationId = String(event.organization);
  const eventParams = { organizationId, eventId: String(event.id) };
  const automatic = (templates ?? []).filter((t) => t.purpose !== 'group');
  const group = (templates ?? []).filter((t) => t.purpose === 'group');
  const editing = templateId === 'new' ? undefined : group.find((t) => String(t.id) === templateId);
  const editorOpen = templateId === 'new' || !!editing;

  const confirmDelete = (template: ApiEmailTemplate) =>
    modals.openConfirmModal({
      title: 'Delete template',
      children: (
        <Text size="sm">
          Delete “{template.name}”? Emails already sent from it stay in the history.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        del.mutate(
          { id: template.id },
          {
            onError: (error) =>
              notifications.show({ color: 'red', message: apiErrorMessage(error) }),
          },
        ),
    });

  const copy = (template: ApiEmailTemplate) =>
    duplicate.mutate(template.id, {
      onSuccess: (copied) => onEditTemplate(String(copied.id)),
      onError: (error) => notifications.show({ color: 'red', message: apiErrorMessage(error) }),
    });

  if (!templates) return <InlineLoading message="Loading templates…" />;

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={3}>Group emails</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={() => onEditTemplate('new')}>
            New template
          </Button>
        </Group>
        {group.length ? (
          <Table.ScrollContainer minWidth={640}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Subject</Table.Th>
                  <Table.Th>Recipients</Table.Th>
                  <Table.Th>Updated</Table.Th>
                  <Table.Th aria-label="Actions" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {group.map((template) => (
                  <Table.Tr key={template.id}>
                    <Table.Td>
                      <Anchor
                        component="button"
                        type="button"
                        onClick={() => onEditTemplate(String(template.id))}
                      >
                        {template.name}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>{template.subject}</Table.Td>
                    <Table.Td>{audienceSummary(template)}</Table.Td>
                    <Table.Td>{formatTime(template.updated_at)}</Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap" justify="flex-end">
                        <Tooltip label="Edit">
                          <ActionIcon
                            variant="subtle"
                            aria-label={`Edit ${template.name}`}
                            onClick={() => onEditTemplate(String(template.id))}
                          >
                            <IconPencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Duplicate">
                          <ActionIcon
                            variant="subtle"
                            aria-label={`Duplicate ${template.name}`}
                            onClick={() => copy(template)}
                            loading={duplicate.isPending && duplicate.variables === template.id}
                          >
                            <IconCopy size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label={`Delete ${template.name}`}
                            onClick={() => confirmDelete(template)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        ) : (
          <Text c="dimmed" size="sm">
            No group emails yet. A template holds a message and who it usually goes to; you review
            the recipients each time it’s sent.
          </Text>
        )}
      </Stack>

      <Stack gap="xs">
        <Title order={3}>Automatic emails</Title>
        <Text size="sm" c="dimmed">
          Sent on their own when someone registers or is invited.
        </Text>
        {automatic.map((template) => (
          <Card key={template.id} withBorder padding="sm">
            <Group justify="space-between" wrap="wrap">
              <Stack gap={0}>
                <Text fw={500}>{template.name}</Text>
                <Text size="sm" c="dimmed">
                  {template.subject || 'No subject'}
                </Text>
              </Stack>
              {template.purpose === 'confirmation' ? (
                <Anchor
                  size="sm"
                  renderRoot={(props) => (
                    <Link
                      {...props}
                      to="/admin/organization/$organizationId/event/$eventId/home"
                      params={eventParams}
                    />
                  )}
                >
                  Edit on Home
                </Anchor>
              ) : (
                <Anchor
                  size="sm"
                  renderRoot={(props) => (
                    <Link
                      {...props}
                      to="/admin/organization/$organizationId/event/$eventId/settings"
                      params={eventParams}
                    />
                  )}
                >
                  Edit in Settings › Registration types
                </Anchor>
              )}
            </Group>
          </Card>
        ))}
      </Stack>

      <Modal
        opened={editorOpen}
        onClose={() => onEditTemplate(undefined)}
        title={editing ? `Edit “${editing.name}”` : 'New group email'}
        size="80rem"
        fullScreen={narrow}
        closeOnClickOutside={false}
      >
        {editorOpen && (
          <GroupTemplateEditor
            key={templateId}
            eventId={event.id}
            organizationId={event.organization}
            defaultFrom={event.confirmation_email_from}
            template={editing}
            helpBase={helpBase}
            onDone={() => onEditTemplate(undefined)}
          />
        )}
      </Modal>
    </Stack>
  );
}

/**
 * Promo codes (SPEC §8.8; §15, DR-67): the event's codes — add, edit, turn off,
 * delete — and, for Registrars and Admins, the deleted ones with Restore.
 * Deleting a code stops registrants using it; registrations that have it keep
 * it, and their discount.
 */

import { Badge, Button, Group, Modal, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import type { ApiPromoCode } from 'api-types';
import { confirmDelete } from 'components/ConfirmDelete';
import { CanEdit, usePermissions } from 'hooks/permissions';
import { useState } from 'react';
import { useDeletedPromoCodes, useRestore } from 'store/deletes';
import { promoCodeHooks } from 'store/entities';
import { apiErrorMessage, apiFieldErrors } from 'utils/fetch';

import { type PromoCodeBody, PromoCodeForm } from './PromoCodeForm';

const SCOPE_LABEL = { registration: 'Registration', camper: 'Each camper' };

const formatDateTime = (iso: string) => new Date(iso).toLocaleString();

function StatusBadge({ promoCode }: { promoCode: ApiPromoCode }) {
  if (!promoCode.enabled) {
    return (
      <Badge color="gray" variant="light">
        Off
      </Badge>
    );
  }
  if (promoCode.expiration_date && new Date(promoCode.expiration_date) < new Date()) {
    return (
      <Badge color="orange" variant="light">
        Expired
      </Badge>
    );
  }
  return (
    <Badge color="green" variant="light">
      Usable
    </Badge>
  );
}

export function PromoCodesSettings({ eventId }: { eventId: string }) {
  const { data: promoCodes } = promoCodeHooks.useList({ event: eventId });
  const { canEdit } = usePermissions();
  const { data: deleted } = useDeletedPromoCodes(eventId, canEdit);
  const create = promoCodeHooks.useCreate();
  const update = promoCodeHooks.useUpdate();
  const remove = promoCodeHooks.useDelete();
  const restore = useRestore('promocodes');
  // The code being edited, or 'new' while adding one.
  const [editing, setEditing] = useState<ApiPromoCode | 'new' | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const close = () => {
    setEditing(null);
    setFieldErrors({});
  };

  const fail = (error: Error) => {
    setFieldErrors(apiFieldErrors(error));
    notifications.show({ color: 'red', message: apiErrorMessage(error) });
  };

  const save = (body: PromoCodeBody) => {
    const done = {
      onSuccess: () => {
        notifications.show({ color: 'green', message: 'Promo code saved' });
        close();
      },
      onError: fail,
    };
    if (editing === 'new') {
      create.mutate({ event: eventId, ...body }, done);
    } else if (editing) {
      update.mutate({ id: editing.id, ...body }, done);
    }
  };

  const confirmDeleteCode = (promoCode: ApiPromoCode) =>
    confirmDelete({
      path: 'promocodes',
      id: promoCode.id,
      title: 'Delete promo code',
      message: (
        <>
          Delete “{promoCode.label}” ({promoCode.code})? Registrants won’t be able to use it; it can
          be restored.
        </>
      ),
      onConfirm: () =>
        remove.mutate(
          { id: promoCode.id },
          {
            onError: (error) =>
              notifications.show({ color: 'red', message: apiErrorMessage(error) }),
          },
        ),
    });

  const restoreCode = (promoCode: ApiPromoCode) =>
    restore.mutate(promoCode.id, {
      onSuccess: () =>
        notifications.show({ color: 'green', message: `Restored ${promoCode.label}.` }),
      onError: (error) => notifications.show({ color: 'red', message: apiErrorMessage(error) }),
    });

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Promo codes</Title>
        <CanEdit>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
            Add promo code
          </Button>
        </CanEdit>
      </Group>
      <Text size="sm" c="dimmed">
        Registrants enter a code while registering for its discount, which comes off after every
        other price line. The registration form offers a promo code field only while one can be
        used.
      </Text>

      <Table.ScrollContainer minWidth={640}>
        <Table withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Label</Table.Th>
              <Table.Th>Code</Table.Th>
              <Table.Th>Discount for</Table.Th>
              <Table.Th>Expires</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th aria-label="Actions" />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(promoCodes ?? []).length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed" size="sm" ta="center" py="md">
                    {promoCodes ? 'No promo codes yet.' : 'Loading…'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              promoCodes!.map((promoCode) => (
                <Table.Tr key={promoCode.id}>
                  <Table.Td>{promoCode.label}</Table.Td>
                  <Table.Td>
                    <Text ff="monospace" size="sm">
                      {promoCode.code}
                    </Text>
                  </Table.Td>
                  <Table.Td>{SCOPE_LABEL[promoCode.scope]}</Table.Td>
                  <Table.Td>
                    {promoCode.expiration_date ? formatDateTime(promoCode.expiration_date) : '—'}
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge promoCode={promoCode} />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap" justify="flex-end">
                      <Button
                        size="compact-sm"
                        variant="light"
                        leftSection={<IconEdit size={14} />}
                        aria-label={`${canEdit ? 'Edit' : 'View'} ${promoCode.label}`}
                        onClick={() => setEditing(promoCode)}
                      >
                        {canEdit ? 'Edit' : 'View'}
                      </Button>
                      <CanEdit>
                        <Button
                          size="compact-sm"
                          variant="light"
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          aria-label={`Delete ${promoCode.label}`}
                          onClick={() => confirmDeleteCode(promoCode)}
                        >
                          Delete
                        </Button>
                      </CanEdit>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {canEdit && deleted && deleted.length > 0 && (
        <Stack gap="xs" mt="md">
          <Title order={4}>Deleted promo codes</Title>
          <Table withTableBorder striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Label</Table.Th>
                <Table.Th>Code</Table.Th>
                <Table.Th>Deleted</Table.Th>
                <Table.Th>By</Table.Th>
                <Table.Th aria-label="Actions" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {deleted.map((promoCode) => (
                <Table.Tr key={promoCode.id}>
                  <Table.Td>{promoCode.label}</Table.Td>
                  <Table.Td>
                    <Text ff="monospace" size="sm">
                      {promoCode.code}
                    </Text>
                  </Table.Td>
                  <Table.Td>{formatDateTime(promoCode.deleted_at)}</Table.Td>
                  <Table.Td>{promoCode.deleted_by?.name ?? '—'}</Table.Td>
                  <Table.Td>
                    <Button
                      size="compact-sm"
                      variant="light"
                      aria-label={`Restore ${promoCode.label}`}
                      loading={restore.isPending && restore.variables === promoCode.id}
                      onClick={() => restoreCode(promoCode)}
                    >
                      Restore
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      )}

      <Modal
        opened={editing !== null}
        onClose={close}
        title={
          editing === 'new'
            ? 'Add a promo code'
            : canEdit
              ? 'Edit promo code'
              : (editing?.label ?? 'Promo code')
        }
        size="lg"
      >
        {editing !== null && (
          <PromoCodeForm
            promoCode={editing === 'new' ? undefined : editing}
            onSubmit={save}
            onCancel={close}
            saving={create.isPending || update.isPending}
            errors={fieldErrors}
          />
        )}
      </Modal>
    </Stack>
  );
}

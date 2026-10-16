/**
 * Manage the event's registration types (SPEC §8.8, §15 DR-32): each type's
 * machine `name`, `label`, and invitation email subject/template, used to invite
 * special/invitation-based registrations (§8.4). Add or edit a type; each
 * persists via POST (new) / PATCH (edit).
 */

import { Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import type { ApiRegistrationType } from 'api-types';
import { BeingEdited } from 'components/EditLease';
import { FullScreenLoading } from 'components/Loading';
import { CanEdit, usePermissions } from 'hooks/permissions';
import { useKeptRecord } from 'hooks/useKeptRecord';
import { useState } from 'react';
import { registrationTypeHooks } from 'store/entities';

import { RegistrationTypeForm } from './registrations/RegistrationTypeForm';

export function RegistrationTypesSettings({
  eventId,
  helpHref,
}: {
  eventId: string;
  /** The Template Help page for invitation emails. */
  helpHref?: string;
}) {
  const { data: registrationTypes } = registrationTypeHooks.useList({ event: eventId });
  const [typeForm, setTypeForm] = useState<{ open: boolean; regType?: ApiRegistrationType }>({
    open: false,
  });

  const { canEdit } = usePermissions();
  // As it is now, so the form can show what someone else saves — and kept open
  // if someone else deletes it meanwhile, so no unsaved edit vanishes (§9.8).
  const openId = typeForm.open && typeForm.regType ? String(typeForm.regType.id) : undefined;
  const { record: shownType, deleted } = useKeptRecord(
    openId,
    registrationTypes?.find((rt) => String(rt.id) === openId),
  );
  if (!registrationTypes) return <FullScreenLoading />;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Registration types</Title>
        <CanEdit>
          <Button
            variant="light"
            size="compact-sm"
            leftSection={<IconPlus size={14} />}
            onClick={() => setTypeForm({ open: true, regType: undefined })}
          >
            Add type
          </Button>
        </CanEdit>
      </Group>

      {registrationTypes.length === 0 ? (
        <Text c="dimmed" size="sm">
          No registration types yet. Add one to enable invitation-based registration.
        </Text>
      ) : (
        <Card withBorder>
          <Stack gap="xs">
            {registrationTypes.map((rt) => (
              <Group key={rt.id} justify="space-between">
                <Text size="sm">
                  {rt.label}{' '}
                  <Text span c="dimmed">
                    ({rt.name})
                  </Text>
                  <BeingEdited model="registrationtype" id={rt.id} ml={6} />
                </Text>
                <Button
                  variant="subtle"
                  size="compact-sm"
                  onClick={() => setTypeForm({ open: true, regType: rt })}
                >
                  {canEdit ? 'Edit' : 'View'}
                </Button>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      <RegistrationTypeForm
        key={typeForm.regType?.id ?? 'new'}
        eventId={eventId}
        regType={shownType ?? typeForm.regType}
        deleted={deleted}
        opened={typeForm.open}
        onClose={() => setTypeForm({ open: false })}
        helpHref={helpHref}
      />
    </Stack>
  );
}

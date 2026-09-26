/**
 * Create or edit a registration type (SPEC §8.4): machine `name`, `label`, and
 * — once it exists — its invitation email, the type's email template (§15
 * DR-45), edited in Jinja and previewed for one of the type's invitations (or an
 * example one). A new type starts with a standard invitation. Persists via POST
 * (new) or PATCH (edit), and the template via its own PATCH.
 */

import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApiRegistrationType } from 'api-types';
import { type EmailSample, EmailTemplateEditor } from 'components/EmailTemplateEditor';
import { useMemo, useState } from 'react';
import type { CreateBody } from 'store/createEntityHooks';
import { useTemplateDraft } from 'store/emailTemplates';
import { invitationHooks, registrationTypeHooks } from 'store/entities';
import { apiErrorMessage } from 'utils/fetch';

interface RegistrationTypeFormProps {
  eventId: string;
  /** Omitted when creating a new type. */
  regType?: ApiRegistrationType;
  opened: boolean;
  onClose: () => void;
  /** The Template Help page for invitation emails. */
  helpHref?: string;
}

export function RegistrationTypeForm({
  eventId,
  regType,
  opened,
  onClose,
  helpHref,
}: RegistrationTypeFormProps) {
  const create = registrationTypeHooks.useCreate();
  const update = registrationTypeHooks.useUpdate();

  const [name, setName] = useState(regType?.name ?? '');
  const [label, setLabel] = useState(regType?.label ?? '');
  const invitationEmail = useTemplateDraft(regType?.invitation_template);

  const { data: invitations } = invitationHooks.useList(
    { registration_type__event: eventId },
    opened && !!regType,
  );
  const samples = useMemo<EmailSample[]>(
    () =>
      (invitations ?? [])
        .filter((i) => regType && String(i.registration_type) === String(regType.id))
        .map((i) => ({
          value: String(i.id),
          label: i.recipient_name
            ? `${i.recipient_name} <${i.recipient_email}>`
            : i.recipient_email,
          sample: { invitation_id: i.id },
        })),
    [invitations, regType],
  );

  const valid = name.trim() && label.trim();

  const save = async () => {
    if (!valid) return;
    try {
      if (regType) {
        await update.mutateAsync({ id: regType.id, name, label });
        await invitationEmail.save();
      } else {
        const body = { event: eventId, name, label } as unknown as CreateBody<ApiRegistrationType>;
        await create.mutateAsync(body);
      }
      notifications.show({ color: 'green', message: 'Registration type saved' });
      onClose();
    } catch (error) {
      notifications.show({ color: 'red', message: apiErrorMessage(error) });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={regType ? 'Edit registration type' : 'New registration type'}
      size="90%"
    >
      <Stack>
        <TextInput
          label="Machine name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Label"
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
          required
        />
        {regType ? (
          <EmailTemplateEditor
            eventId={eventId}
            context="invitation_email"
            subject={invitationEmail.subject}
            onSubjectChange={invitationEmail.setSubject}
            body={invitationEmail.body}
            onBodyChange={invitationEmail.setBody}
            samples={samples}
            baseSample={{ registration_type_id: regType.id }}
            helpHref={helpHref}
          />
        ) : (
          <Text size="sm" c="dimmed">
            A new type starts with a standard invitation email; edit the type to change it.
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void save()}
            disabled={!valid}
            loading={create.isPending || update.isPending || invitationEmail.saving}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

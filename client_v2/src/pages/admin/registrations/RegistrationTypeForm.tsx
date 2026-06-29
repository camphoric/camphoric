/**
 * Create or edit a registration type (SPEC §8.4): machine `name`, `label`, and
 * the invitation email subject/template. Persists via POST (new) or PATCH (edit).
 */

import { Button, Group, Modal, Stack, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApiRegistrationType } from 'api-types';
import { useState } from 'react';
import { registrationTypeHooks } from 'store/entities';

interface RegistrationTypeFormProps {
  eventId: string;
  /** Omitted when creating a new type. */
  regType?: ApiRegistrationType;
  opened: boolean;
  onClose: () => void;
}

export function RegistrationTypeForm({
  eventId,
  regType,
  opened,
  onClose,
}: RegistrationTypeFormProps) {
  const create = registrationTypeHooks.useCreate();
  const update = registrationTypeHooks.useUpdate();

  const [name, setName] = useState(regType?.name ?? '');
  const [label, setLabel] = useState(regType?.label ?? '');
  const [subject, setSubject] = useState(regType?.invitation_email_subject ?? '');
  const [template, setTemplate] = useState(regType?.invitation_email_template ?? '');

  const valid = name.trim() && label.trim() && subject.trim() && template.trim();

  const save = () => {
    if (!valid) return;
    const fields = {
      name,
      label,
      invitation_email_subject: subject,
      invitation_email_template: template,
    };
    const onSuccess = () => {
      notifications.show({ color: 'green', message: 'Registration type saved' });
      onClose();
    };
    if (regType) {
      update.mutate({ id: regType.id, ...fields }, { onSuccess });
    } else {
      create.mutate({ event: eventId, ...fields }, { onSuccess });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={regType ? 'Edit registration type' : 'New registration type'}
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
        <TextInput
          label="Invitation email subject"
          value={subject}
          onChange={(e) => setSubject(e.currentTarget.value)}
          required
        />
        <Textarea
          label="Invitation email template"
          value={template}
          onChange={(e) => setTemplate(e.currentTarget.value)}
          autosize
          minRows={4}
          required
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!valid} loading={create.isPending || update.isPending}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

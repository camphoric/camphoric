/**
 * Create or edit a registration type (SPEC §8.4): machine `name`, `label`, and
 * the invitation email — its engine, subject and template. New types are
 * written in Jinja, previewed for one of the type's invitations (or an example
 * one). Persists via POST (new) or PATCH (edit).
 */

import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApiRegistrationType, TemplateEngine } from 'api-types';
import { type EmailSample, EmailTemplateEditor } from 'components/EmailTemplateEditor';
import { useMemo, useState } from 'react';
import { invitationHooks, registrationTypeHooks } from 'store/entities';

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
  const [subject, setSubject] = useState(regType?.invitation_email_subject ?? '');
  const [template, setTemplate] = useState(regType?.invitation_email_template ?? '');
  const [engine, setEngine] = useState<TemplateEngine>(regType?.invitation_email_engine ?? 'jinja');

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

  const valid = name.trim() && label.trim() && subject.trim() && template.trim();

  const save = () => {
    if (!valid) return;
    const fields = {
      name,
      label,
      invitation_email_subject: subject,
      invitation_email_template: template,
      invitation_email_engine: engine,
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
        <EmailTemplateEditor
          eventId={eventId}
          context="invitation_email"
          engine={engine}
          onEngineChange={setEngine}
          subject={subject}
          onSubjectChange={setSubject}
          body={template}
          onBodyChange={setTemplate}
          samples={samples}
          baseSample={regType ? { registration_type_id: regType.id } : undefined}
          helpHref={helpHref}
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

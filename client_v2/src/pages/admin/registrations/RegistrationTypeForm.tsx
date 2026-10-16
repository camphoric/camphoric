/**
 * Create or edit a registration type (SPEC §8.4): machine `name`, `label`, and
 * — once it exists — its invitation email, the type's email template (§15
 * DR-45), edited in Jinja and previewed for one of the type's invitations (or an
 * example one). A new type starts with a standard invitation. Persists via POST
 * (new) or PATCH (edit), and the template via its own PATCH, each from the
 * version it was opened at, so saving over someone else's change asks first
 * (§9.8, DR-109). Closing it with the invitation email changed and unsaved asks
 * first, and discards the edits.
 */

import { Button, Modal, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApiRegistrationType } from 'api-types';
import { EditLeaseNotice } from 'components/EditLease';
import { type EmailSample, EmailTemplateEditor } from 'components/EmailTemplateEditor';
import { FormActions } from 'components/FormActions';
import { CanEdit, ReadOnlyFieldset, usePermissions, ViewOnly } from 'hooks/permissions';
import { useConflictAwareSave, useLatestWhileUnchanged } from 'hooks/useEditableRecord';
import { useEditLease } from 'hooks/useEditLease';
import { useTemplateDraft } from 'hooks/useTemplateDraft';
import { useUnsavedChanges } from 'hooks/useUnsavedChanges';
import { useMemo, useState } from 'react';
import type { CreateBody } from 'store/createEntityHooks';
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
  regType: latest,
  opened,
  onClose,
  helpHref,
}: RegistrationTypeFormProps) {
  // The version shown: a newer one shows while nothing here is unsaved.
  const [regType, showVersion] = useLatestWhileUnchanged<ApiRegistrationType>(
    latest,
    (): boolean => !dirty,
    (record) => {
      setName(record.name);
      setLabel(record.label);
    },
  );
  const create = registrationTypeHooks.useCreate();
  const update = registrationTypeHooks.useUpdate({ handlesVersionConflict: true });
  const saveType = useConflictAwareSave(
    regType,
    {
      toForm: (current: ApiRegistrationType) => ({ name: current.name, label: current.label }),
      saveRecord: update.mutateAsync,
      label: 'registration type',
    },
    true,
  );

  const [name, setName] = useState(regType?.name ?? '');
  const [label, setLabel] = useState(regType?.label ?? '');
  const { canEdit } = usePermissions();
  const invitationEmail = useTemplateDraft(regType?.invitation_template);
  const { confirmDiscard } = useUnsavedChanges(opened && invitationEmail.changed);
  // Who else is editing it (§9.8): held while the open form has unsaved changes.
  const dirty =
    !!regType && (name !== regType.name || label !== regType.label || invitationEmail.changed);
  const lease = useEditLease(
    regType && opened ? 'registrationtype' : undefined,
    regType?.id ?? 0,
    dirty,
  );
  const close = () =>
    confirmDiscard(() => {
      invitationEmail.discard();
      onClose();
    });

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
        // Sends nothing when only the invitation email changed, and remembers
        // what it saved, so trying again (say, after fixing the email) starts there.
        const outcome = await saveType({ name, label }, (form) => {
          setName(form.name);
          setLabel(form.label);
        });
        // Theirs, or what was saved (the form stays open if the email fails to save).
        const latest = outcome?.saved ?? outcome?.discarded;
        if (latest) showVersion(latest);
        if (!outcome?.saved || !(await invitationEmail.save())) return;
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
      onClose={close}
      title={
        regType ? (canEdit ? 'Edit registration type' : regType.label) : 'New registration type'
      }
      size="90%"
      closeOnClickOutside={false}
      // Escape belongs to the template editor (dismissing suggestions);
      // closing here would discard the edits.
      closeOnEscape={false}
    >
      <EditLeaseNotice label="registration type" lease={lease} />
      <ViewOnly when={lease.viewOnly}>
        <Stack>
          <ReadOnlyFieldset>
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
            </Stack>
          </ReadOnlyFieldset>
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
          <FormActions>
            <Button variant="default" onClick={close}>
              {canEdit ? 'Cancel' : 'Close'}
            </Button>
            <CanEdit>
              <Button
                onClick={() => void save()}
                disabled={!valid}
                loading={create.isPending || update.isPending || invitationEmail.saving}
              >
                Save
              </Button>
            </CanEdit>
          </FormActions>
        </Stack>
      </ViewOnly>
    </Modal>
  );
}

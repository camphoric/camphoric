/**
 * Invite a special registration (SPEC §8.4): choose a registration type and
 * enter recipient name + email; creates the invitation and sends it
 * (POST /invitations/{id}/send). The server generates the invitation code.
 */

import { Button, Group, Modal, Select, Stack, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApiInvitation, ApiRegistrationType } from 'api-types';
import { useState } from 'react';
import type { CreateBody } from 'store/createEntityHooks';
import { invitationHooks } from 'store/entities';
import { useSendInvitation } from 'store/invitations';

interface InviteFormProps {
  registrationTypes: ApiRegistrationType[];
  opened: boolean;
  onClose: () => void;
}

export function InviteForm({ registrationTypes, opened, onClose }: InviteFormProps) {
  const create = invitationHooks.useCreate();
  const send = useSendInvitation();

  const [type, setType] = useState(registrationTypes[0] ? String(registrationTypes[0].id) : '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const valid = type && name.trim() && email.trim();

  const reset = () => {
    setName('');
    setEmail('');
  };

  const submit = () => {
    if (!valid) return;
    // The server fills in invitation_code; send only the chosen fields.
    const body = {
      registration_type: Number(type),
      recipient_name: name,
      recipient_email: email,
    } as unknown as CreateBody<ApiInvitation>;

    create.mutate(body, {
      onSuccess: (invitation) =>
        send.mutate(invitation.id, {
          onSuccess: () => {
            notifications.show({ color: 'green', message: 'Invitation sent' });
            reset();
            onClose();
          },
        }),
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Invite a special registration">
      <Stack>
        <Select
          label="Registration type"
          data={registrationTypes.map((rt) => ({ value: String(rt.id), label: rt.label }))}
          value={type}
          onChange={(value) => setType(value ?? '')}
          allowDeselect={false}
          required
        />
        <TextInput
          label="Recipient name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Recipient email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid} loading={create.isPending || send.isPending}>
            Send invite
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

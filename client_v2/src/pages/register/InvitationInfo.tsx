/**
 * Invitation context shown above the registration steps (SPEC §6, §7) when the
 * registrant arrived via an invitation code, plus any invitation error.
 */

import { Alert } from '@mantine/core';
import { IconMail } from '@tabler/icons-react';
import type { ApiRegister } from 'api-types';

interface InvitationInfoProps {
  invitation?: ApiRegister['invitation'];
  registrationType?: ApiRegister['registrationType'];
  error?: string;
}

export function InvitationInfo({ invitation, registrationType, error }: InvitationInfoProps) {
  if (error) {
    return (
      <Alert color="red" variant="light" title="Invitation problem">
        {error}
      </Alert>
    );
  }
  if (!invitation) return null;

  return (
    <Alert color="teal" variant="light" icon={<IconMail size={18} />} title="You're invited">
      Welcome, {invitation.recipient_name}.
      {registrationType ? ` You're registering as: ${registrationType.label}.` : null}
    </Alert>
  );
}

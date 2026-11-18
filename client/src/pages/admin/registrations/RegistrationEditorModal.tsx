/**
 * A registration's editor, open over the page while `?registrationId` names one
 * (SPEC §4, §8.4): from the Registrations list, and from the Payments area
 * (§8.11). It's kept open if someone else deletes the registration meanwhile, so
 * no unsaved edit vanishes (§9.8).
 */

import { Modal } from '@mantine/core';
import type { AugmentedRegistration } from 'api-types';
import { RecordDeleted } from 'components/EditLease';
import { useRegistrationTypeLookup } from 'hooks/useAdminData';
import { useKeptRecord } from 'hooks/useKeptRecord';
import { EDITOR_MODAL_SIZE, editorModalStyles } from 'pages/admin/editorModalStyles';
import { eventHooks } from 'store/entities';

import { RegistrationEdit } from './RegistrationEdit';

interface RegistrationEditorModalProps {
  eventId: string;
  /** The open registration's id (`?registrationId`), if any. */
  registrationId: string | undefined;
  /** The event's registrations, to find it among. */
  registrations: AugmentedRegistration[];
  onClose: () => void;
}

export function RegistrationEditorModal({
  eventId,
  registrationId,
  registrations,
  onClose,
}: RegistrationEditorModalProps) {
  const { data: event } = eventHooks.useById(eventId);
  const registrationTypes = useRegistrationTypeLookup(eventId);
  const { record: selected, deleted } = useKeptRecord(
    registrationId,
    registrations.find((r) => String(r.id) === registrationId),
  );

  return (
    <Modal
      opened={!!selected}
      onClose={onClose}
      title={selected?.registrant_email || 'Registration'}
      size={EDITOR_MODAL_SIZE}
      styles={editorModalStyles}
    >
      {deleted && <RecordDeleted label="registration" />}
      {selected && event && registrationTypes && (
        <RegistrationEdit
          key={selected.id}
          event={event}
          registration={selected}
          registrationTypes={registrationTypes}
          onDeleted={onClose}
        />
      )}
    </Modal>
  );
}

/**
 * Says who else is editing a record (SPEC §9.8; §15, DR-110), and since when.
 * With nothing unsaved here, the record is shown as it is, and the user can
 * take over editing it. With unsaved changes here, it warns that someone else
 * has it too; saving still shows them what that person changed first (DR-109).
 */

import { Alert, Button } from '@mantine/core';
import type { ApiEditLease } from 'api-types';
import { useCurrentUser } from 'hooks/auth';
import { CanEdit } from 'hooks/permissions';
import type { EditLeaseState } from 'hooks/useEditLease';

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export interface EditLeaseNoticeViewProps {
  /** What's being edited, e.g. "registration". */
  label: string;
  lease: ApiEditLease;
  /** The holder is the signed-in user, in another tab or window. */
  isYou: boolean;
  /** This form has unsaved changes. */
  overlapping: boolean;
  onTakeOver: () => void;
}

export function EditLeaseNoticeView({
  label,
  lease,
  isYou,
  overlapping,
  onTakeOver,
}: EditLeaseNoticeViewProps) {
  const who = isYou ? 'You are' : `${lease.holder.name} is`;
  const where = isYou ? ' in another tab' : '';
  return (
    <Alert
      color={overlapping ? 'yellow' : 'blue'}
      mb="md"
      title={`${who} editing this ${label}${where}`}
    >
      {overlapping
        ? 'Your changes here aren’t saved yet. Saving shows you anything they’ve saved first.'
        : `Since ${time(lease.acquired_at)}. It opens for editing here once ${
            isYou ? 'you’re done there' : 'they’re done'
          }.`}{' '}
      <CanEdit>
        <Button variant="subtle" size="compact-sm" onClick={onTakeOver}>
          {overlapping ? 'Take it back' : 'Edit anyway'}
        </Button>
      </CanEdit>
    </Alert>
  );
}

/** The notice for a form's lease, when someone else holds it. */
export function EditLeaseNotice({ label, lease }: { label: string; lease: EditLeaseState }) {
  if (!lease.other) return null;
  return <HeldNotice label={label} lease={lease} other={lease.other} />;
}

function HeldNotice({
  label,
  lease,
  other,
}: {
  label: string;
  lease: EditLeaseState;
  other: ApiEditLease;
}) {
  const { data: user } = useCurrentUser();
  return (
    <EditLeaseNoticeView
      label={label}
      lease={other}
      isYou={other.holder.id === user?.id}
      overlapping={lease.overlapping}
      onTakeOver={() => void lease.takeOver()}
    />
  );
}

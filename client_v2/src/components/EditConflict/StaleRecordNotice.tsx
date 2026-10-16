/**
 * Says that someone else saved the record while this form has unsaved edits
 * (SPEC §9.8, DR-109), and offers to drop the edits for their version. Saving
 * anyway goes through the edit conflict, which shows what they changed first.
 */

import { Alert, Button } from '@mantine/core';

interface StaleRecordNoticeProps {
  /** What's being edited, e.g. "registration". */
  label: string;
  onLoadLatest: () => void;
}

export function StaleRecordNotice({ label, onLoadLatest }: StaleRecordNoticeProps) {
  return (
    <Alert color="yellow" mb="md" title={`Someone else changed this ${label}`}>
      Your changes aren’t saved yet. Saving shows you what they changed first.{' '}
      <Button variant="subtle" size="compact-sm" onClick={onLoadLatest}>
        Discard mine and load theirs
      </Button>
    </Alert>
  );
}

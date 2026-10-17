/**
 * Says the record an open editor shows was deleted by someone else meanwhile
 * (SPEC §9.8): it can't be saved, but the editor stays, as the user left it,
 * until they close it — so nothing typed vanishes unseen, and it can be copied.
 */

import { Alert } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

export function RecordDeleted({ label }: { label: string }) {
  return (
    <Alert
      color="orange"
      variant="light"
      icon={<IconTrash size={18} />}
      title={`Someone else deleted this ${label}`}
      mb="md"
    >
      It can’t be saved now. Your changes stay here until you close it, so you can copy anything you
      need.
    </Alert>
  );
}

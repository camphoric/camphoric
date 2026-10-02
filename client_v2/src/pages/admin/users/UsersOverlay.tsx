/**
 * Users as an overlay (SPEC §8.10; §15, DR-84): it fills the screen over
 * whatever admin page is showing (`?overlay=users`), with a close button in
 * the upper right that returns to that page as it was. Only Admins see it.
 */

import { Modal } from '@mantine/core';
import { usePermissions } from 'hooks/permissions';
import { useOverlay } from 'navigation/overlay';

import { UsersPage } from './UsersPage';

export function UsersOverlay() {
  const { canManageUsers } = usePermissions();
  const { overlay, close } = useOverlay();
  const opened = overlay === 'users' && canManageUsers;
  return (
    <Modal
      opened={opened}
      onClose={close}
      fullScreen
      // The modal's title is its heading already; sized as a page title.
      title="Users"
      styles={{ title: { fontSize: 'var(--mantine-h2-font-size)', fontWeight: 700 } }}
      closeButtonProps={{ 'aria-label': 'Close users' }}
      // Escape belongs to the dialogs opened inside it (editing a user, …),
      // which would otherwise close along with it; the close button leaves.
      closeOnEscape={false}
    >
      {opened && <UsersPage />}
    </Modal>
  );
}

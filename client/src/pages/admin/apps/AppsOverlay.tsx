/**
 * Apps as an overlay (SPEC §8.10; §15, DR-84): it fills the screen over
 * whatever admin page is showing (`?overlay=apps`), with a close button in the
 * upper right that returns to that page as it was. Only Admins see it.
 */

import { Modal } from '@mantine/core';
import { usePermissions } from 'hooks/permissions';
import { useOverlay } from 'navigation/overlay';

import { AppsPage } from './AppsPage';

export function AppsOverlay() {
  const { canManageApps } = usePermissions();
  const { overlay, close } = useOverlay();
  const opened = overlay === 'apps' && canManageApps;
  return (
    <Modal
      opened={opened}
      onClose={close}
      fullScreen
      title="Apps"
      styles={{ title: { fontSize: 'var(--mantine-h2-font-size)', fontWeight: 700 } }}
      closeButtonProps={{ 'aria-label': 'Close apps' }}
      // Escape belongs to the dialogs opened inside it (editing an app, …).
      closeOnEscape={false}
    >
      {opened && <AppsPage />}
    </Modal>
  );
}

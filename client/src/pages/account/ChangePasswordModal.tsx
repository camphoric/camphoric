/** Change your own password, from the user menu (SPEC §6). */

import { Modal } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { ChangePasswordForm } from './ChangePasswordForm';

export function ChangePasswordModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title="Change your password">
      {opened && (
        <ChangePasswordForm
          onCancel={onClose}
          onDone={() => {
            notifications.show({ color: 'green', message: 'Your password is changed.' });
            onClose();
          }}
        />
      )}
    </Modal>
  );
}

/**
 * Sign in again over the admin once the session has ended (SPEC §6; §15 DR-26,
 * DR-127). The admin stays mounted underneath, out of reach, so signing back in
 * carries on exactly where the user left off, unsaved edits included. It can't
 * be dismissed: the ways on are signing in (as the same user, or someone else)
 * and asking for a set-password link.
 */

import { getDefaultZIndex, Modal, Text } from '@mantine/core';
import { useOnlyReachable } from 'navigation/useOnlyReachable';
import { useState } from 'react';

import { ForgotPasswordForm } from './ForgotPasswordForm';
import { SignInForm } from './Login';

export function SignInAgain({ username }: { username: string }) {
  const [forgot, setForgot] = useState(false);
  const root = useOnlyReachable();

  return (
    <Modal
      opened
      onClose={() => undefined}
      title={forgot ? 'Forgot your password?' : 'Sign in again'}
      withCloseButton={false}
      closeOnEscape={false}
      closeOnClickOutside={false}
      centered
      portalProps={{ target: root }}
      // Above any dialog or menu left open in the admin.
      zIndex={getDefaultZIndex('popover')}
      overlayProps={{ blur: 3 }}
    >
      {forgot ? (
        <ForgotPasswordForm onBack={() => setForgot(false)} />
      ) : (
        <SignInForm
          intro={
            <Text size="sm">
              Your session has ended. Sign in to carry on where you left off: anything you haven’t
              saved is still here.
            </Text>
          }
          username={username}
          onForgot={() => setForgot(true)}
        />
      )}
    </Modal>
  );
}

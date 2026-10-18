/**
 * Sign in again over the admin once the session has ended (SPEC §6; §15 DR-26,
 * DR-127). The admin stays mounted underneath, out of reach, so signing back in
 * carries on exactly where the user left off, unsaved edits included. It can't
 * be dismissed: the ways on are signing in (as the same user, or someone else)
 * and asking for a set-password link.
 */

import { getDefaultZIndex, Modal, Text } from '@mantine/core';
import { useLayoutEffect, useState } from 'react';

import { ForgotPasswordForm } from './ForgotPasswordForm';
import { SignInForm } from './Login';

let promptsOpen = 0;

// While the prompt is up, Escape mustn't close a dialog left open underneath.
// Mantine's modals hear it on window in the capture phase, and re-add their
// listeners on every render, so this one, added once as the module loads,
// comes before any of theirs.
if (typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    (event) => {
      if (promptsOpen > 0 && event.key === 'Escape') event.stopImmediatePropagation();
    },
    true,
  );
}

/**
 * Everything on the page but `root` is inert while it's mounted: the admin, and
 * whatever it has open in portals of its own (dialogs, drawers, menus), and
 * anything added to the page meanwhile. No pointer, keyboard or focus reaches
 * them.
 */
function useOnlyReachable(root: HTMLElement) {
  useLayoutEffect(() => {
    document.body.appendChild(root);
    promptsOpen += 1;
    const shut: Element[] = [];
    const shutOut = (node: Node) => {
      if (!(node instanceof Element) || node === root || node.hasAttribute('inert')) return;
      node.setAttribute('inert', '');
      shut.push(node);
    };
    document.body.childNodes.forEach(shutOut);
    const observer = new MutationObserver((records) =>
      records.forEach((record) => record.addedNodes.forEach(shutOut)),
    );
    observer.observe(document.body, { childList: true });
    return () => {
      observer.disconnect();
      shut.forEach((element) => element.removeAttribute('inert'));
      root.remove();
      promptsOpen -= 1;
    };
  }, [root]);
}

export function SignInAgain({ username }: { username: string }) {
  const [forgot, setForgot] = useState(false);
  const [root] = useState(() => document.createElement('div'));
  useOnlyReachable(root);

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

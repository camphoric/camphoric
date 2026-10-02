/**
 * Ask before unsaved template edits are lost (SPEC §9.6). While `dirty`,
 * leaving the page — a link, back/forward, any URL change, reloading or closing
 * the tab — first asks whether to discard the changes; `confirmDiscard` asks the
 * same before the page's own ways of dropping them (Cancel, closing a dialog,
 * choosing something else). Call `release` once the edits are saved, so the
 * navigation that follows a save isn't questioned.
 *
 * Opening or closing an overlay (Users) isn't leaving: the page stays as it
 * is underneath. Works through the router's history, so outside a router (unit
 * tests and stories) only `confirmDiscard` asks.
 */

import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { type RouterHistory, useRouter } from '@tanstack/react-router';
import { onlyOverlayChanged } from 'navigation/overlay';
import { useEffect, useRef } from 'react';

/** Resolves true when the user chooses to discard their changes. */
export function confirmDiscardChanges(): Promise<boolean> {
  return new Promise((resolve) => {
    modals.openConfirmModal({
      title: 'Discard unsaved changes?',
      children: (
        <Text size="sm">
          You’ve changed this template without saving it. If you go on, your changes will be lost.
        </Text>
      ),
      labels: { confirm: 'Discard changes', cancel: 'Keep editing' },
      confirmProps: { color: 'red' },
      onConfirm: () => resolve(true),
      // Cancel, the close button and Escape; after a confirm this is a no-op.
      onClose: () => resolve(false),
    });
  });
}

export function useUnsavedChanges(dirty: boolean) {
  const router = useRouter({ warn: false }) as { history: RouterHistory } | undefined;
  const dirtyRef = useRef(dirty);
  // Saved, or discarded on purpose: let the page go without asking.
  const released = useRef(false);

  useEffect(() => {
    dirtyRef.current = dirty;
    if (!dirty) released.current = false;
  }, [dirty]);

  useEffect(() => {
    if (!router) return undefined;
    const blocking = () => dirtyRef.current && !released.current;
    return router.history.block({
      // true blocks the navigation.
      blockerFn: async ({ currentLocation, nextLocation }) => {
        if (!blocking() || onlyOverlayChanged(currentLocation, nextLocation)) return false;
        if (!(await confirmDiscardChanges())) return true;
        released.current = true;
        return false;
      },
      enableBeforeUnload: blocking,
    });
  }, [router]);

  return {
    /** Run `action` — after asking, when there are unsaved changes. */
    confirmDiscard: (action: () => void) => {
      if (!dirty || released.current) {
        action();
        return;
      }
      void confirmDiscardChanges().then((discard) => {
        if (!discard) return;
        released.current = true;
        action();
      });
    },
    release: () => {
      released.current = true;
    },
  };
}

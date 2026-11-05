/**
 * A prompt that must be answered before anything else on the page (SPEC §6;
 * §15 DR-127, DR-145): signing in again, or agreeing to an organization's terms,
 * over the admin. Everything on the page but the prompt's own root is inert
 * while it's mounted — the admin, whatever it has open in portals of its own
 * (dialogs, drawers, menus), and anything added to the page meanwhile — so no
 * pointer, keyboard or focus reaches them, and Escape closes nothing underneath.
 */

import { useLayoutEffect, useState } from 'react';

let promptsOpen = 0;

// While a prompt is up, Escape mustn't close a dialog left open underneath.
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

/** The element to portal the prompt into; everything else is inert while it's mounted. */
export function useOnlyReachable(): HTMLElement {
  const [root] = useState(() => document.createElement('div'));
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
  return root;
}

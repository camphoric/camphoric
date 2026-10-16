/**
 * Print an HTML document by itself, without the page around it (SPEC §8.7).
 * The document loads into a hidden, sandboxed frame whose print dialog is then
 * opened; the frame goes away after printing, or when the next print starts.
 */

let current: HTMLIFrameElement | null = null;

function discard(frame: HTMLIFrameElement) {
  frame.remove();
  if (current === frame) current = null;
}

export function printHtml(html: string, title: string): void {
  if (current) discard(current);

  const frame = document.createElement('iframe');
  current = frame;
  frame.title = title;
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');
  // No allow-scripts: the document can't run code, so granting same-origin
  // (to call print()) doesn't give it access to the page. allow-modals lets
  // the frame open the print dialog.
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  Object.assign(frame.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
  });
  frame.addEventListener(
    'load',
    () => {
      const win = frame.contentWindow;
      if (!win) return;
      win.addEventListener('afterprint', () => discard(frame), { once: true });
      // Not focused first: focus would be lost when the frame goes.
      win.print();
    },
    { once: true },
  );
  frame.srcdoc = html;
  document.body.appendChild(frame);
}

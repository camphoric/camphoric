/**
 * Print an HTML document by itself, without the page around it (SPEC §8.7).
 * The document loads into a hidden, sandboxed frame whose print dialog is then
 * opened. The frame stays until the next print replaces it: some browsers
 * report printing done while their dialog is still open, and removing the
 * frame then would blank the print.
 */

let current: HTMLIFrameElement | null = null;

export function printHtml(html: string, title: string): void {
  current?.remove();

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
      // Not focused first, so focus stays where it was.
      frame.contentWindow?.print();
    },
    { once: true },
  );
  frame.srcdoc = html;
  document.body.appendChild(frame);
}

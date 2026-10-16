import { afterEach, describe, expect, it, vi } from 'vitest';

import { printHtml } from '../print';

const frames = () => [...document.querySelectorAll('iframe')];

/** Start a print, with the frame's print dialog stubbed before it loads. */
function startPrint(html: string, title: string) {
  printHtml(html, title);
  const frame = frames().at(-1)!;
  const win = frame.contentWindow!;
  const print = vi.spyOn(win, 'print').mockImplementation(() => {});
  return { frame, win, print };
}

afterEach(() => {
  frames().forEach((frame) => frame.remove());
});

describe('printHtml', () => {
  it('prints the document from a hidden frame that runs no scripts', async () => {
    const { frame, print } = startPrint('<p>Roster</p>', 'Roster');

    expect(frame.srcdoc).toBe('<p>Roster</p>');
    expect(frame.title).toBe('Roster');
    expect(frame.getAttribute('sandbox')).toBe('allow-same-origin allow-modals');
    expect(frame).toHaveAttribute('aria-hidden', 'true');
    expect(frame.style.width).toBe('0px');

    await vi.waitFor(() => expect(print).toHaveBeenCalledOnce());
  });

  it('removes the frame after printing', async () => {
    const { win, print } = startPrint('<p>Roster</p>', 'Roster');
    await vi.waitFor(() => expect(print).toHaveBeenCalled());

    win.dispatchEvent(new Event('afterprint'));
    expect(frames()).toHaveLength(0);
  });

  it('replaces a frame left from an earlier print', async () => {
    startPrint('<p>One</p>', 'One');
    const { print } = startPrint('<p>Two</p>', 'Two');

    expect(frames().map((frame) => frame.title)).toEqual(['Two']);
    await vi.waitFor(() => expect(print).toHaveBeenCalled());
  });
});

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { markdownToHtml, TABLE_SCROLL_CLASS } from '../pipeline';
import { RenderedMarkdown, SCROLLING_TABLE_LABEL } from '../RenderedMarkdown';

const table = markdownToHtml('| a | b |\n| - | - |\n| 1 | 2 |');

// The stylesheet giving the boxes their overflow
const style = document.createElement('style');

/** Lay boxes out (jsdom doesn't): content this wide, in a box this wide, with this overflow. */
function layOut({ content, box, overflowX }: { content: number; box: number; overflowX: string }) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(content);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(box);
  style.textContent = `.${TABLE_SCROLL_CLASS} { overflow-x: ${overflowX}; }`;
  document.head.append(style);
}

afterEach(() => {
  vi.restoreAllMocks();
  style.remove();
});

describe('RenderedMarkdown', () => {
  it('lets the keyboard reach a table box that scrolls', () => {
    layOut({ content: 500, box: 300, overflowX: 'auto' });
    render(<RenderedMarkdown html={table} />);

    const box = screen.getByRole('group', { name: SCROLLING_TABLE_LABEL });
    expect(box).toHaveAttribute('tabindex', '0');
    expect(box.querySelector('table')).not.toBeNull();
  });

  it('adds no tab stop for a table that fits', () => {
    layOut({ content: 300, box: 300, overflowX: 'auto' });
    const { container } = render(<RenderedMarkdown html={table} />);

    expect(container.querySelector('[tabindex]')).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('adds none where the box lets its table overflow (a report scrolls it instead)', () => {
    layOut({ content: 500, box: 300, overflowX: 'visible' });
    const { container } = render(<RenderedMarkdown html={table} />);

    expect(container.querySelector('[tabindex]')).toBeNull();
  });

  it('looks again at the tables when the HTML changes', () => {
    layOut({ content: 500, box: 300, overflowX: 'auto' });
    const { rerender } = render(<RenderedMarkdown html={markdownToHtml('No table yet')} />);
    expect(screen.queryByRole('group')).toBeNull();

    rerender(<RenderedMarkdown html={table} />);
    expect(screen.getByRole('group', { name: SCROLLING_TABLE_LABEL })).toBeInTheDocument();
  });
});

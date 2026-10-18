import { describe, expect, it } from 'vitest';

import { markdownToHtml, TABLE_SCROLL_CLASS, templateToHtml } from '../pipeline';

describe('markdownToHtml — sanitization (SPEC §9.3, §11)', () => {
  it('renders gfm markdown to HTML', () => {
    expect(markdownToHtml('**bold**')).toContain('<strong>bold</strong>');
  });

  it('strips dangerous tags like <script>', () => {
    const html = markdownToHtml('<script>alert(1)</script>hello');
    expect(html).not.toContain('<script');
    expect(html).toContain('hello');
  });

  it('permits class and style on div/span', () => {
    const html = markdownToHtml('<div class="no-break" style="color: red">hi</div>');
    expect(html).toContain('class="no-break"');
    expect(html).toContain('style="color: red"');
    expect(html).toContain('hi');
  });

  it("keeps only the print classes, not the app's own (DR-132)", () => {
    // m_3d7bc908 is a Mantine class fixing a box over the whole viewport.
    expect(markdownToHtml('<div class="m_3d7bc908 page-break mantine-Overlay-root">x</div>')).toBe(
      '<div class="page-break">x</div>',
    );
    expect(markdownToHtml('<span class="md-template">x</span>')).not.toContain('md-template');
  });

  it('keeps only the CSS that cannot draw over the page (DR-132)', () => {
    const html = markdownToHtml(
      '<div style="position: fixed; inset: 0; z-index: 9999; font-weight: bold">Pay here</div>',
    );
    expect(html).toBe('<div style="font-weight: bold">Pay here</div>');
    expect(markdownToHtml('<span style="position: absolute; top: 0">x</span>')).toBe(
      '<p><span>x</span></p>',
    );
  });

  it('opens external links in a new tab', () => {
    const html = markdownToHtml('[site](https://example.com)');
    expect(html).toContain('target="_blank"');
  });
});

describe('markdownToHtml — tables', () => {
  /** The rendered HTML, parsed. */
  const render = (markdown: string) => {
    const container = document.createElement('div');
    container.innerHTML = markdownToHtml(markdown);
    return container;
  };

  it('puts a markdown table in a box of its own', () => {
    const container = render('Rates:\n\n| a | b |\n| - | - |\n| 1 | 2 |');
    const table = container.querySelector('table');
    expect(table?.parentElement?.className).toBe(TABLE_SCROLL_CLASS);
    expect(container.querySelectorAll(`.${TABLE_SCROLL_CLASS}`)).toHaveLength(1);
  });

  it('boxes an HTML table too, wherever it sits, but not one inside another', () => {
    const container = render(
      '<div class="no-break"><table><tr><td><table><tr><td>inner</td></tr></table></td></tr></table></div>',
    );
    const [outer, inner] = container.querySelectorAll('table');
    expect(outer?.parentElement?.className).toBe(TABLE_SCROLL_CLASS);
    expect(outer?.parentElement?.parentElement?.className).toBe('no-break');
    expect(inner?.parentElement?.tagName).toBe('TD');
  });
});

describe('templateToHtml — full pipeline', () => {
  it('substitutes Handlebars variables then renders markdown', () => {
    const { __html } = templateToHtml('Hello **{{name}}**', { name: 'Bob' });
    expect(__html).toContain('<strong>Bob</strong>');
  });
});

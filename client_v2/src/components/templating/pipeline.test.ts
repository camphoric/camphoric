import { describe, expect, it } from 'vitest';

import { markdownToHtml, templateToHtml } from './pipeline';

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
    const html = markdownToHtml('<div class="box" style="color: red">hi</div>');
    expect(html).toContain('class="box"');
    expect(html).toContain('style="color: red"');
    expect(html).toContain('hi');
  });

  it('opens external links in a new tab', () => {
    const html = markdownToHtml('[site](https://example.com)');
    expect(html).toContain('target="_blank"');
  });
});

describe('templateToHtml — full pipeline', () => {
  it('substitutes Handlebars variables then renders markdown', () => {
    const { __html } = templateToHtml('Hello **{{name}}**', { name: 'Bob' });
    expect(__html).toContain('<strong>Bob</strong>');
  });
});

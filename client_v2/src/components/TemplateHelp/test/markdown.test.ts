import { markdownToHtml } from 'components/templating';
import { describe, expect, it } from 'vitest';

import { MARKDOWN_ENTRIES, markdownIntro, searchMarkdown } from '../markdown';

const rendered = (key: string) =>
  markdownToHtml(MARKDOWN_ENTRIES.find((entry) => entry.key === key)!.example);

describe('markdown reference', () => {
  it('renders each example as its description says', () => {
    expect(rendered('paragraphs')).toMatch(/Cabin 702<br>\s*Linens rental: Yes\s+Meals/);
    expect(rendered('links')).toContain('href="mailto:info@example.org"');
    expect(rendered('tables')).toContain('<td align="right">$150.00</td>');
    expect(rendered('rules')).toContain('<hr>');
    expect(rendered('escaping')).toContain('*Early bird*');
    expect(rendered('escaping')).not.toContain('<h1>');
    expect(rendered('html')).toContain('<span style="color: green">Paid in full</span>');
  });

  it('says where the output goes', () => {
    expect(markdownIntro('confirmation_email')).toContain('plain-text version');
    expect(markdownIntro('bulk_email_camper')).toContain('HTML tags in it are dropped');
    expect(markdownIntro('confirmation_page')).toContain('registrant');
    expect(markdownIntro('report')).toContain('CSV');
  });

  it('searches titles, descriptions and examples', () => {
    expect(searchMarkdown('')).toBe(MARKDOWN_ENTRIES);
    expect(searchMarkdown('MD_CELL').map((entry) => entry.key)).toEqual(['tables']);
    expect(searchMarkdown('mailto')).toEqual([]);
  });
});

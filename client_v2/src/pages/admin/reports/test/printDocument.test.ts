import { describe, expect, it } from 'vitest';

import { reportPrintDocument } from '../printDocument';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('reportPrintDocument', () => {
  it('is a complete document titled for the report, with the print styles', () => {
    const html = reportPrintDocument('Roster', 'txt', 'Pat');
    expect(html.startsWith('<!doctype html>')).toBe(true);

    const doc = parse(html);
    expect(doc.title).toBe('Roster');
    const css = doc.querySelector('style')!.textContent;
    expect(css).toContain('@page');
    expect(css).toContain('.page-break { break-before: page; }');
    expect(css).toContain('.no-break { break-inside: avoid; }');
    // Breaks need a block: a span is made one.
    expect(css).toContain('span.page-break { display: block; }');
  });

  it('prints a csv as a numbered table whose header row repeats on each page', () => {
    const doc = parse(reportPrintDocument('Roster', 'csv', 'Name,Cabin\nPat,<b>A</b>\nSam,B\n'));

    const head = [...doc.querySelectorAll('thead th')].map((th) => th.textContent);
    expect(head).toEqual(['', 'Name', 'Cabin']);
    const rows = [...doc.querySelectorAll<HTMLTableRowElement>('tbody tr')].map((tr) =>
      [...tr.cells].map((td) => td.textContent),
    );
    expect(rows).toEqual([
      ['1', 'Pat', '<b>A</b>'],
      ['2', 'Sam', 'B'],
    ]);
    expect(doc.querySelector('b')).toBeNull();
    const css = doc.querySelector('style')!.textContent;
    expect(css).toContain('thead { display: table-header-group; }');
    expect(css).toContain('overflow-wrap: anywhere;');
  });

  it('prints markdown sanitized, keeping the page-break classes', () => {
    const doc = parse(
      reportPrintDocument(
        'Cabins',
        'md',
        '<div class="page-break">\n\n## Cabin A\n\n</div>\n\n<script>alert(1)</script>',
      ),
    );

    expect(doc.querySelector('.md-template .page-break h2')?.textContent).toBe('Cabin A');
    expect(doc.querySelector('script')).toBeNull();
  });

  it('prints text as preformatted text', () => {
    const doc = parse(reportPrintDocument('Notes', 'txt', 'a <b>\n  b'));
    expect(doc.querySelector('pre')!.textContent).toBe('a <b>\n  b');
  });

  it('keeps an html report’s own title and styles, after Camphoric’s', () => {
    const doc = parse(
      reportPrintDocument(
        'Tags',
        'html',
        '<html><head><title>Name tags</title><style>.tag { break-inside: avoid; }</style></head>' +
          '<body><div class="tag">Pat</div></body></html>',
      ),
    );

    expect(doc.title).toBe('Name tags');
    const styles = [...doc.querySelectorAll('style')].map((s) => s.textContent);
    expect(styles).toHaveLength(2);
    expect(styles[0]).toContain('@page');
    // Camphoric lays out only its own formats; an html report's look is its own.
    expect(styles[0]).not.toContain('font-family');
    expect(styles[1]).toBe('.tag { break-inside: avoid; }');
    expect(doc.querySelector('.tag')?.textContent).toBe('Pat');
  });

  it('gives an html fragment a head and the report’s title', () => {
    const doc = parse(reportPrintDocument('Tags', 'html', '<p>Pat</p>'));
    expect(doc.title).toBe('Tags');
    expect(doc.head.querySelector('style')).not.toBeNull();
    expect(doc.body.querySelector('p')?.textContent).toBe('Pat');
  });
});

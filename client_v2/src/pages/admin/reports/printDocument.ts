/**
 * The standalone document a report prints from (SPEC §8.7): the output alone,
 * with print styles — page margins, a csv table's header row repeated on each
 * page, and the page-break classes report authors can use (`page-break`,
 * `no-break`). An `html` report keeps its own markup and styles; its styles
 * come after Camphoric's, so they win.
 */

import type { ReportOutputType } from 'api-types';
import { markdownToHtml } from 'components/templating';
import { csvParseRows } from 'd3-dsv';

/** Print rules for every format, `html` reports included. */
const PAGE_CSS = `
@page { margin: 1.5cm; }
thead { display: table-header-group; }
tr, img { break-inside: avoid; }
h1, h2, h3, h4, h5, h6 { break-after: avoid; }
.page-break { break-before: page; }
.no-break { break-inside: avoid; }
/* Breaks apply only to blocks; a span is inline unless made one. */
span.page-break { display: block; }
span.no-break { display: inline-block; }
`;

/** Type and table styles for the formats Camphoric lays out (csv, md, txt). */
const CONTENT_CSS = `
body {
  margin: 0;
  color: #000;
  background: #fff;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 11pt;
  line-height: 1.4;
  /* Long values wrap rather than running off the page's edge. */
  overflow-wrap: anywhere;
}
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #888; padding: 2pt 5pt; text-align: left; vertical-align: top; }
img { max-width: 100%; }
pre { margin: 0; white-space: pre-wrap; font-size: 10pt; }
`;

/** Handlebars reports render in the page, and aren't printed on their own. */
export type PrintableOutput = Exclude<ReportOutputType, 'hbs'>;

/** A report's output, as a complete HTML document ready to print. */
export function reportPrintDocument(
  title: string,
  format: PrintableOutput,
  output: string,
): string {
  // Neither kind of document runs scripts: both are inert until printed, and
  // print from a sandboxed frame (utils/print). An html report without a
  // doctype is parsed as the frames showing it do, never in quirks mode.
  const doc =
    format === 'html'
      ? new DOMParser().parseFromString(
          /^\s*<!doctype/i.test(output) ? output : `<!doctype html>${output}`,
          'text/html',
        )
      : document.implementation.createHTMLDocument(title);
  if (!doc.title) doc.title = title;

  const style = doc.createElement('style');
  style.textContent = format === 'html' ? PAGE_CSS : PAGE_CSS + CONTENT_CSS;
  doc.head.prepend(style);

  if (format === 'csv') doc.body.append(csvTable(doc, output));
  if (format === 'md') {
    const wrapper = doc.createElement('div');
    wrapper.className = 'md-template';
    // Safe: markdownToHtml sanitizes via rehype-sanitize (§11).
    wrapper.innerHTML = markdownToHtml(output);
    doc.body.append(wrapper);
  }
  if (format === 'txt') {
    const pre = doc.createElement('pre');
    pre.textContent = output;
    doc.body.append(pre);
  }

  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

/** The csv as a table, numbered like the on-screen one, its header row in a `<thead>`. */
function csvTable(doc: Document, csv: string): HTMLTableElement {
  const [header = [], ...rows] = csvParseRows(csv.trim());
  const table = doc.createElement('table');
  const row = (section: HTMLTableSectionElement, tag: 'th' | 'td', cells: string[]) => {
    const tr = section.insertRow();
    for (const text of cells) {
      const cell = doc.createElement(tag);
      cell.textContent = text;
      tr.append(cell);
    }
  };
  row(table.createTHead(), 'th', ['', ...header]);
  const body = table.createTBody();
  rows.forEach((cells, i) => row(body, 'td', [String(i + 1), ...cells]));
  return table;
}

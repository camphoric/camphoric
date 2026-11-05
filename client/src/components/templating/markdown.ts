/**
 * The markdown → HTML half of the template pipeline (SPEC §9.3): GitHub-flavoured
 * Markdown, raw HTML allowed and then sanitized. Kept apart from Handlebars so
 * the OAuth terms page's script (termsMarkdown.ts, DR-151) renders contracts
 * exactly as the admin does without loading the rest.
 *
 * SECURITY: the output is inserted as HTML, so rehype-sanitize is mandatory —
 * never bypass it (SPEC §11, CONTRIBUTING).
 */

import type { Element, Root } from 'hast';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { rehypeSafeStyles } from './safeStyles';

/**
 * The classes a template may put on a div/span: the print page breaks
 * (printDocument). Any other class is dropped, since the app's own stylesheets
 * (Mantine's among them) have classes that fix a box over the whole page (DR-132).
 */
const TEMPLATE_CLASSES = ['page-break', 'no-break'];

// Permit the print classes and style on div/span on top of the safe defaults;
// everything else is still sanitized. rehypeSafeStyles then keeps only the CSS
// that can't draw over the page (DR-132).
const sanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes?.div ?? []), ['className', ...TEMPLATE_CLASSES], 'style'],
    span: [...(defaultSchema.attributes?.span ?? []), ['className', ...TEMPLATE_CLASSES], 'style'],
  },
};

/** The class of the box each rendered table sits in (styled in markdown.css). */
export const TABLE_SCROLL_CLASS = 'md-table-scroll';

/**
 * Put each table in a box of its own that scrolls sideways (markdown.css), so
 * a table wider than the screen — an event's rates, on a phone — scrolls there
 * instead of widening the page.
 */
function rehypeScrollableTables() {
  const wrapTables = (parent: Root | Element) => {
    parent.children = parent.children.map((child) => {
      if (child.type !== 'element') return child;
      if (child.tagName !== 'table') {
        wrapTables(child);
        return child;
      }
      return {
        type: 'element',
        tagName: 'div',
        properties: { className: [TABLE_SCROLL_CLASS] },
        children: [child],
      } satisfies Element;
    });
  };
  return wrapTables;
}

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeSafeStyles)
  .use(rehypeScrollableTables)
  .use(rehypeExternalLinks, { target: '_blank' })
  .use(rehypeStringify);

/** Render markdown to sanitized HTML. */
export function markdownToHtml(markdown: string): string {
  return String(markdownProcessor.processSync(markdown));
}

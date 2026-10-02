/**
 * The Markdown reference in Template Help (SPEC §9.3): the GitHub-flavored
 * Markdown that emails, the confirmation page and Markdown reports are written
 * in, each construct with an example whose result the panel renders. Emails
 * are converted on the server (cmark-gfm), pages in the client's sanitizing
 * pipeline; the two agree on everything here except raw HTML.
 */

import type { TemplateContextName } from 'api-types';

export interface MarkdownEntry {
  key: string;
  title: string;
  /** Plain text; `backticked` names are shown as code. */
  doc: string;
  /** Markdown, inserted as is. */
  example: string;
  /** Whether the panel renders the example (not for images, which would load). */
  showResult: boolean;
}

const entry = (key: string, title: string, doc: string, example: string, showResult = true) => ({
  key,
  title,
  doc,
  example,
  showResult,
});

export const MARKDOWN_ENTRIES: MarkdownEntry[] = [
  entry(
    'paragraphs',
    'Paragraphs and line breaks',
    'A blank line starts a new paragraph. A single line break is joined into the line ' +
      'before it — end the line with `\\` (or two spaces, which are easy to lose) to keep ' +
      'the break. Jinja tags leave their line behind, so a loop can add blank lines that ' +
      'split paragraphs; trim them with `{%-`.',
    [
      'Thank you for registering!',
      '',
      'Housing: Cabin 702\\',
      'Linens rental: Yes',
      'Meals: Vegetarian',
    ].join('\n'),
  ),
  entry(
    'headings',
    'Headings',
    'One to six `#`s, then a space. A line of text with `===` or `---` right under it is a ' +
      'heading too.',
    ['# See you at camp!', '## Your campers', '### Lee'].join('\n'),
  ),
  entry(
    'emphasis',
    'Bold, italic and struck out',
    '`**` or `__` for bold, `*` or `_` for italic, `~~` to strike out.',
    'Make your check for **$450.00**, *not* ~~$400.00~~.',
  ),
  entry(
    'lists',
    'Lists',
    'Start each item with `-`, `*` or a number and a period; indent an item to nest it. A ' +
      'numbered list counts on from its first number.',
    ['- Sleeping bag', '- Flashlight', '  - and spare batteries', '', '1. Register', '1. Pay'].join(
      '\n',
    ),
  ),
  entry(
    'links',
    'Links',
    'The link text in brackets, then the address in parentheses. Web and email addresses ' +
      'written out become links on their own.',
    [
      'Sign up on the [workshop form](https://example.org/workshops).',
      '',
      'Questions? Email info@example.org or see https://example.org.',
    ].join('\n'),
  ),
  entry(
    'images',
    'Images',
    'Like a link, with a `!` in front; the bracketed text describes the image for those who ' +
      'can’t see it. Use a full `https://` address of an image that’s already online.',
    '![Map of camp](https://example.org/camp-map.png)',
    false,
  ),
  entry(
    'tables',
    'Tables',
    'A header row, then a row of dashes; a colon on the left, both sides or the right aligns ' +
      'the column. Write the rows in a loop, passing values through `md_cell` so a `|` or ' +
      'line break in them can’t break the table: `| {{ camper.attributes.first_name | ' +
      'md_cell }} |`.',
    [
      '| Camper | Nights | Fee |',
      '|:--|:-:|--:|',
      '| Lee | 3 | $90.00 |',
      '| Sam | 5 | $150.00 |',
    ].join('\n'),
  ),
  entry(
    'rules',
    'Dividing lines',
    'Three or more `-`, `*` or `_` alone on a line. Leave a blank line above it: right under ' +
      'a line of text, `---` turns that text into a heading instead.',
    ['Lee — 3 nights', '', '------', '', 'Sam — 5 nights'].join('\n'),
  ),
  entry('quotes', 'Quotes', 'Start each line with `>`.', '> Please bring your own mug.'),
  entry(
    'code',
    'Code',
    'Text between backticks is shown as it is, in a fixed-width font.',
    'Your registration number is `2026CH42`.',
  ),
  entry(
    'escaping',
    'Showing the symbols themselves',
    'A backslash before a punctuation mark shows the mark instead of its meaning. Values ' +
      'that Jinja outputs are Markdown too, so a `*` or `_` in an answer can turn text italic.',
    ['\\*Early bird\\* rates end November 15.', '', '\\# 1 in our hearts'].join('\n'),
  ),
  entry(
    'html',
    'HTML',
    'Pages (the registration form’s text, the confirmation page and Markdown reports) allow ' +
      'a little HTML: `div` and `span` with `class` and `style`, and other harmless tags; ' +
      'scripts and the like are removed. Emails drop every HTML tag (the text between them ' +
      'stays), so write them in Markdown.',
    '<span style="color: green">Paid in full</span>',
  ),
];

const EMAIL_CONTEXTS: TemplateContextName[] = [
  'confirmation_email',
  'invitation_email',
  'bulk_email_registration',
  'bulk_email_camper',
  'bulk_email_manual',
];

/** Where the context's output goes as Markdown — the reference's opening line. */
export function markdownIntro(context: TemplateContextName): string {
  if (EMAIL_CONTEXTS.includes(context)) {
    return (
      'This email’s body is Markdown: after Jinja runs, its output becomes the email’s ' +
      'formatted (HTML) version, and is sent as it is as the plain-text version. HTML tags in it ' +
      'are dropped.'
    );
  }
  if (context === 'confirmation_page') {
    return 'This page is Markdown: after Jinja runs, the registrant sees its output formatted.';
  }
  if (context === 'report') {
    return (
      'A report whose output is Markdown is shown formatted; CSV, text and HTML reports are ' +
      'shown as they are.'
    );
  }
  return 'Templates written in Markdown are formatted after Jinja runs.';
}

/** The entries whose title, description or example contain the query. */
export function searchMarkdown(query: string): MarkdownEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return MARKDOWN_ENTRIES;
  return MARKDOWN_ENTRIES.filter((e) =>
    [e.title, e.doc, e.example].some((text) => text.toLowerCase().includes(q)),
  );
}

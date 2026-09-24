/**
 * Two-stage template rendering (SPEC §9.3): Handlebars variable substitution,
 * then a markdown → HTML pipeline with mandatory sanitization. Used for
 * descriptions, pre-submit/confirmation content, and Handlebars reports.
 *
 * SECURITY: the output is inserted via dangerouslySetInnerHTML, so
 * rehype-sanitize is mandatory — never bypass it (SPEC §11, CONTRIBUTING).
 */

import Handlebars from 'handlebars';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { templateHelpers } from './helpers';

// An isolated Handlebars instance so helper registration doesn't leak globally.
const handlebars = Handlebars.create();
Object.entries(templateHelpers).forEach(([name, { fn }]) => {
  handlebars.registerHelper(name, fn);
});

// Permit class/style on div/span (templates use them for layout) on top of the
// safe defaults; everything else is still sanitized.
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes?.div ?? []), 'className', 'style'],
    span: [...(defaultSchema.attributes?.span ?? []), 'className', 'style'],
  },
};

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeExternalLinks, { target: '_blank' })
  .use(rehypeStringify);

/** Substitute Handlebars variables, producing markdown. */
export function processHandlebarsTemplate(template: string, vars: object = {}): string {
  return handlebars.compile(template)(vars);
}

// Plain-text templates (validation messages) are rendered on every validation
// pass, so their compiled form is cached.
const plainTextTemplates = new Map<string, HandlebarsTemplateDelegate>();

/**
 * Substitute Handlebars variables without HTML-escaping, for short plain-text
 * strings such as validation messages. The result must only ever be rendered
 * as React text (which escapes it), never as HTML.
 */
export function renderPlainTextTemplate(template: string, vars: object = {}): string {
  let compiled = plainTextTemplates.get(template);
  if (!compiled) {
    compiled = handlebars.compile(template, { noEscape: true });
    plainTextTemplates.set(template, compiled);
  }
  return compiled(vars);
}

const knownHelpers = Object.fromEntries(Object.keys(templateHelpers).map((name) => [name, true]));

/**
 * Check a template up front (compilation is otherwise lazy): returns the syntax
 * or unknown-helper error message, or null when the template is valid.
 */
export function checkTemplate(template: string): string | null {
  try {
    handlebars.precompile(template, { knownHelpers, knownHelpersOnly: true });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Render markdown to sanitized HTML. */
export function markdownToHtml(markdown: string): string {
  return String(markdownProcessor.processSync(markdown));
}

/** Shape consumed by React's dangerouslySetInnerHTML. */
export interface DangerousHtml {
  __html: string;
}

/** Full pipeline: Handlebars → markdown → sanitized HTML. */
export function templateToHtml(template: string, vars: object = {}): DangerousHtml {
  return { __html: markdownToHtml(processHandlebarsTemplate(template, vars)) };
}

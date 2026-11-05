/**
 * Two-stage template rendering (SPEC §9.3): Handlebars variable substitution,
 * then a markdown → HTML pipeline with mandatory sanitization. Used for
 * descriptions, pre-submit/confirmation content, and Handlebars reports.
 *
 * SECURITY: the output is inserted via dangerouslySetInnerHTML, so
 * rehype-sanitize is mandatory — never bypass it (SPEC §11, CONTRIBUTING).
 */

import Handlebars from 'handlebars';

import { templateHelpers } from './helpers';
import { markdownToHtml } from './markdown';

export { markdownToHtml, TABLE_SCROLL_CLASS } from './markdown';

// An isolated Handlebars instance so helper registration doesn't leak globally.
const handlebars = Handlebars.create();
Object.entries(templateHelpers).forEach(([name, { fn }]) => {
  handlebars.registerHelper(name, fn);
});

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

/** Shape consumed by React's dangerouslySetInnerHTML. */
export interface DangerousHtml {
  __html: string;
}

/** Full pipeline: Handlebars → markdown → sanitized HTML. */
export function templateToHtml(template: string, vars: object = {}): DangerousHtml {
  return { __html: markdownToHtml(processHandlebarsTemplate(template, vars)) };
}

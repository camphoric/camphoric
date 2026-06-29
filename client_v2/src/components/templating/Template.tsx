/**
 * Renders a Handlebars+markdown template to sanitized HTML (SPEC §9.3). Render
 * errors are caught and shown in a <pre> rather than crashing the surrounding
 * page (CONTRIBUTING: don't let template rendering take down the page).
 */

import { templateToHtml } from './pipeline';

interface TemplateProps {
  markdown?: string;
  templateVars?: object;
}

export function Template({ markdown, templateVars = {} }: TemplateProps) {
  const source = typeof markdown === 'string' ? markdown : '';

  let html;
  try {
    html = templateToHtml(source, templateVars);
  } catch (error) {
    html = { __html: `<pre>error with template render\n\n${String(error)}\n</pre>` };
  }

  // Safe: the HTML is sanitized by rehype-sanitize in the pipeline (§11).
  return <div className="md-template" dangerouslySetInnerHTML={html} />;
}

/**
 * Renders a Handlebars+markdown template to sanitized HTML (SPEC §9.3). Render
 * errors are caught and shown in a <pre> rather than crashing the surrounding
 * page (CONTRIBUTING: don't let template rendering take down the page).
 */

import { templateToHtml } from './pipeline';
import { RenderedMarkdown } from './RenderedMarkdown';

interface TemplateProps {
  markdown?: string;
  templateVars?: object;
}

export function Template({ markdown, templateVars = {} }: TemplateProps) {
  const source = typeof markdown === 'string' ? markdown : '';

  let html;
  try {
    html = templateToHtml(source, templateVars).__html;
  } catch (error) {
    // As text, never HTML: the error quotes the template, markup and all.
    return (
      <div className="md-template">
        <pre>{`error with template render\n\n${String(error)}\n`}</pre>
      </div>
    );
  }

  return <RenderedMarkdown html={html} />;
}

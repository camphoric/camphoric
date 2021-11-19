import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSanitize, {defaultSchema} from 'rehype-sanitize';

import Handlebars from 'handlebars';

Handlebars.registerHelper('abs', function(num) {
  const abs = Math.abs(num);

  if (!abs) return num;

  return abs;
});

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize, defaultSchema)
  .use(rehypeStringify)

export function markdown2Html(template: string): string {
  return String(processor.processSync(template));
}

export function processHandlebarsTemplate(template: string, vars: {} = {}): string {
  return Handlebars.compile(template)(vars);
}

// used for dangerouslySetInnerHTML
// https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml
type DangerousHtmlObject = {
  __html: string,
};

export function template2Html(template: string, vars: {} = {}): DangerousHtmlObject {
  const processedMarkdown = processHandlebarsTemplate(template, vars);
  const html = markdown2Html(processedMarkdown);

  return { __html: html };
}

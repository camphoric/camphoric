import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeSanitize, {defaultSchema} from 'rehype-sanitize';

// @ts-ignore
import Handlebars from 'handlebars/dist/cjs/handlebars';

import helpers from './handlebarsHelpers';

Object.entries(helpers).forEach(
  ([key, [help, fn]]) => {
    Handlebars.registerHelper(key, fn);
  },
);

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, {allowDangerousHtml: true})
  .use(rehypeRaw)
  .use(rehypeSanitize, {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      div: [
        ...(defaultSchema?.attributes?.div || []),
        ['className'],
        ['style'],
      ],
      span: [
        ...(defaultSchema?.attributes?.span || []),
        ['className'],
        ['style'],
      ]
    }
  })
  .use(rehypeExternalLinks, {target: '_blank'})
  .use(rehypeStringify);

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

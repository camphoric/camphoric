import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSanitize, {defaultSchema} from 'rehype-sanitize';
import getFromPath from 'lodash/get';
import Handlebars from 'handlebars//dist/cjs/handlebars';

// @ts-ignore
Handlebars.registerHelper('abs', function(num: number) {
  const abs = Math.abs(num);

  if (!abs) return num;

  return abs;
});

// @ts-ignore
Handlebars.registerHelper('eachsort', function(arr: Array<any>, keyPath?: string, options) {
  if (!options) {
    options = keyPath;
    keyPath = undefined;
  }

  const arrSorted =  arr.sort((a, b) => {
    const aval = !!keyPath ? getFromPath(a, keyPath) : a;
    const bval = !!keyPath ? getFromPath(b, keyPath) : b;

    if (aval < bval) {
      return -1;
    }

    if (aval > bval) {
      return 1;
    }

    // names must be equal
    return 0;
  });

  return arrSorted.map(options.fn).join('');
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
  // @ts-ignore
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

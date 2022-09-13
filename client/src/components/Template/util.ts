import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeSanitize, {defaultSchema} from 'rehype-sanitize';
import getFromPath from 'lodash/get';
// @ts-ignore
import Handlebars from 'handlebars/dist/cjs/handlebars';

// For inspiration on helpers
// https://github.com/helpers/handlebars-helpers

// @ts-ignore
Handlebars.registerHelper('abs', function(num: number) {
  const abs = Math.abs(num);

  if (!abs) return num;

  return abs;
});

// @ts-ignore
Handlebars.registerHelper('lt', function(a, b) {
  return Number(a) < Number(b)
});

// @ts-ignore
Handlebars.registerHelper('gt', function(a, b) {
  return Number(a) > Number(b)
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

// @ts-ignore
Handlebars.registerHelper('eachrsort', function(arr: Array<any>, keyPath?: string, options) {
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
  }).reverse();

  return arrSorted.map(options.fn).join('');
});


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
